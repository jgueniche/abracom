import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getPracticeProvider } from "@/lib/ai/provider";
import type { PracticeProvider, PromptPart } from "@/lib/ai/types";
import { processImage } from "@/lib/media";
import { audioClips } from "@/lib/practice/answers";
import { kindsFor, type LevelCode } from "@/lib/practice/curriculum";
import { homeworkPrompt, illustrationPrompt, SYSTEM_PROMPT } from "@/lib/practice/prompt";
import {
  isBetaSheet,
  parseSheet,
  type PracticeLevel,
  type Sheet,
  sheetJsonSchema,
} from "@/lib/practice/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";

/**
 * Prepares one practice sheet, start to end (ADR-0087). Runs after the request has answered
 * (`after()`), with the service key: the reader's right to the homework was checked before
 * the row was claimed, and nothing here is shown to anyone but the readers of that homework.
 *
 * Each stage is written to the row as it starts, so the family waiting sees what is actually
 * happening rather than an animation. The exercises are required; the illustration and the
 * voices are not — if either fails, the sheet is published without it.
 */

const BUCKET = "practice";
/** Pages read by the model: the first three photos, and one PDF if it is small. */
const MAX_IMAGES = 3;
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const VOICE_CONCURRENCY = 4;

type Admin = SupabaseClient<Database>;
type Stage = "reading" | "writing" | "drawing" | "voicing";

export async function prepareSheet(sheetId: string): Promise<void> {
  const provider = getPracticeProvider();
  const admin = createAdminClient();
  if (!provider) {
    await fail(admin, sheetId, "provider_off");
    return;
  }
  try {
    await prepare(admin, provider, sheetId);
  } catch (error) {
    console.error("[practice] prepare:", (error as Error).message);
    const code = (error as { code?: unknown }).code;
    await fail(admin, sheetId, typeof code === "string" ? code : "provider_error");
  }
}

async function prepare(admin: Admin, provider: PracticeProvider, sheetId: string) {
  const { data: row, error } = await admin
    .from("practice_sheets")
    .select(
      `id, school_id, class_id, level, status,
       post:class_posts ( title, body_md, subject, deleted_at,
         class:classes ( level:levels ( code, label_fr ) ),
         media:class_post_media ( storage_path, kind, size_bytes, sort_order ) )`,
    )
    .eq("id", sheetId)
    .maybeSingle();
  if (error) throw error;
  if (!row || row.status !== "pending" || !row.post || row.post.deleted_at) return;
  const post = row.post;
  const levelCode = (post.class?.level?.code ?? null) as LevelCode | null;

  // ── 1. Read the homework and its pages ──────────────────────────────────
  await stage(admin, sheetId, "reading");
  const files = await readPages(
    admin,
    [...post.media].sort((a, b) => a.sort_order - b.sort_order),
  );
  const parts: PromptPart[] = [
    {
      text: homeworkPrompt(
        {
          title: post.title,
          body: post.body_md,
          subject: post.subject,
          levelCode,
          levelLabel: post.class?.level?.label_fr ?? null,
          attachments: files.length,
        },
        row.level as PracticeLevel,
      ),
    },
    ...files.map((file) => ({ file })),
  ];

  // ── 2. Write the exercises (one more try if the answer does not hold) ───
  await stage(admin, sheetId, "writing");
  const request = { system: SYSTEM_PROMPT, parts, schema: sheetJsonSchema() };
  let sheet = keepLevel(parseSheet(await provider.writeSheet(request)), levelCode);
  if (!sheet) sheet = keepLevel(parseSheet(await provider.writeSheet(request)), levelCode);
  if (!sheet) {
    await fail(admin, sheetId, "invalid_output");
    return;
  }

  const folder = `${row.school_id}/${row.class_id}/${sheetId}`;

  // ── 3. Draw the illustration ─────────────────────────────────────────────
  await stage(admin, sheetId, "drawing");
  let illustrationPath: string | null = null;
  const picture = await provider.illustrate(illustrationPrompt(sheet.illustration));
  if (picture) {
    try {
      const image = await processImage(picture, { maxEdge: 1400, quality: 80 });
      const path = `${folder}/illustration.webp`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, image.buffer, { contentType: "image/webp", upsert: true });
      if (uploadError) console.warn("[practice] illustration upload:", uploadError.message);
      else illustrationPath = path;
    } catch (imageError) {
      console.warn("[practice] illustration:", (imageError as Error).message);
    }
  }

  // ── 4. Record the voices ─────────────────────────────────────────────────
  const clips = audioClips(sheet);
  const audio: Record<string, string> = {};
  if (clips.length > 0) {
    await stage(admin, sheetId, "voicing");
    await inBatches(clips, VOICE_CONCURRENCY, async (clip) => {
      const wav = await provider.speak(
        clip.text,
        clip.lang,
        clip.id.includes("-w") ? "word" : "text",
      );
      if (!wav) return;
      const path = `${folder}/${clip.id}.wav`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, wav, { contentType: "audio/wav", upsert: true });
      if (uploadError) console.warn("[practice] voice upload:", uploadError.message);
      else audio[clip.id] = path;
    });
  }

  // ── 5. Publish ────────────────────────────────────────────────────────────
  const { error: saveError } = await admin
    .from("practice_sheets")
    .update({
      status: "ready",
      stage: null,
      error: null,
      content: { ...sheet, audio } as unknown as Json,
      beta: isBetaSheet(sheet, post.subject),
      illustration_path: illustrationPath,
      model: provider.textModel,
    })
    .eq("id", sheetId)
    .eq("status", "pending");
  if (saveError) throw saveError;
}

/** Drops the exercises a level cannot do (a dictation in PS); null if nothing is left. */
function keepLevel(sheet: Sheet | null, level: LevelCode | null): Sheet | null {
  if (!sheet) return null;
  const allowed = kindsFor(level);
  const exercises = sheet.exercises.filter((exercise) => allowed.includes(exercise.kind));
  return exercises.length > 0 ? { ...sheet, exercises } : null;
}

async function readPages(
  admin: Admin,
  media: { storage_path: string; kind: string; size_bytes: number | null }[],
): Promise<{ mimeType: string; data: Buffer }[]> {
  const wanted = [
    ...media.filter((item) => item.kind === "image").slice(0, MAX_IMAGES),
    ...media
      .filter((item) => item.kind === "pdf" && (item.size_bytes ?? Infinity) <= MAX_PDF_BYTES)
      .slice(0, 1),
  ];
  const files = await Promise.all(
    wanted.map(async (item) => {
      const { data, error } = await admin.storage.from("class-media").download(item.storage_path);
      if (error || !data) return null;
      const mimeType = item.kind === "pdf" ? "application/pdf" : data.type || "image/webp";
      return { mimeType, data: Buffer.from(await data.arrayBuffer()) };
    }),
  );
  return files.filter((file) => file !== null);
}

async function stage(admin: Admin, sheetId: string, value: Stage) {
  await admin
    .from("practice_sheets")
    .update({ stage: value })
    .eq("id", sheetId)
    .eq("status", "pending");
}

async function fail(admin: Admin, sheetId: string, code: string) {
  await admin
    .from("practice_sheets")
    .update({ status: "failed", stage: null, error: code.slice(0, 200) })
    .eq("id", sheetId)
    .eq("status", "pending");
}

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(run));
  }
}
