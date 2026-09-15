"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/auth/session";
import { IMAGE_MIME_TYPES, processImage } from "@/lib/media";
import { BUCKETS, MAX_UPLOAD_BYTES, safeFileName } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

import { type ActionState, field, optional, toActionError, uuid } from "./admin/_shared";

/**
 * Publishing lives apart from the rest of the class-post actions because it is the only one that
 * needs `processImage`, and so the only one that needs `sharp` — whose native libvips weighs 16 Mo.
 * A Server Action is bundled into every route that imports it, so while `saveClassPost` sat beside
 * `toggleHomeworkSeen`, screens that only read publications shipped libvips too: `/devoirs` and the
 * cahier de vie carried 21,75 Mo of function for a tick box (ADR-0066).
 */

const postSchema = z.object({
  id: z.string().regex(uuid).nullable(),
  classId: z.string().regex(uuid),
  type: z.enum(["homework", "journal", "info", "reminder"]),
  title: z.string().trim().min(1).max(200),
  bodyMd: z.string().max(20000),
  subject: z.string().trim().max(60).nullable(),
  dueOn: z.iso.date().nullable(),
  visibility: z.enum(["parents", "staff"]),
  publish: z.boolean(),
});

export type PostFormState = ActionState & { postId?: string };

/**
 * Teachers publish in their classes: a homework, or an entry of the cahier de
 * vie filed under one of its three categories (journal, info, reminder).
 * Passing `id` re-opens an existing publication — supported here since session
 * 5, reachable from the interface only since ADR-0059.
 */
export async function saveClassPost(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  try {
    const t = await getTranslations("classSpace.post");
    const user = await requireCurrentUser();
    const parsed = postSchema.safeParse({
      id: optional(formData, "id"),
      classId: field(formData, "classId"),
      type: field(formData, "type"),
      title: field(formData, "title"),
      bodyMd: String(formData.get("bodyMd") ?? ""),
      subject: optional(formData, "subject"),
      dueOn: optional(formData, "dueOn"),
      visibility: field(formData, "visibility") || "parents",
      publish: formData.get("intent") !== "draft",
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };
    if (parsed.data.type === "homework" && !parsed.data.dueOn)
      return { status: "error", message: t("dueRequired") };

    const supabase = await createClient();
    const { data: cls } = await supabase
      .from("classes")
      .select("school_id")
      .eq("id", parsed.data.classId)
      .maybeSingle();
    if (!cls) return { status: "error", message: t("saveError") };

    let postId = parsed.data.id;
    let publishedAt: string | null = parsed.data.publish ? new Date().toISOString() : null;
    if (postId) {
      // only the author (or the direction, through RLS) edits a post; media follow the same rule
      const { data: existing } = await supabase
        .from("class_posts")
        .select("author_id, published_at")
        .eq("id", postId)
        .eq("class_id", parsed.data.classId)
        .maybeSingle();
      if (!existing) return { status: "error", message: t("saveError") };
      if (parsed.data.publish && existing.published_at) publishedAt = existing.published_at;
    }
    const values = {
      type: parsed.data.type,
      title: parsed.data.title,
      body_md: parsed.data.bodyMd,
      subject: parsed.data.subject,
      due_on: parsed.data.dueOn,
      visibility: parsed.data.visibility,
      published_at: publishedAt,
    };
    if (postId) {
      const { data: updated, error } = await supabase
        .from("class_posts")
        .update(values)
        .eq("id", postId)
        .select("id");
      if (error || !updated?.length) return { status: "error", message: t("saveError") };
    } else {
      const { data, error } = await supabase
        .from("class_posts")
        .insert({
          ...values,
          class_id: parsed.data.classId,
          school_id: cls.school_id,
          author_id: user.id,
        })
        .select("id")
        .single();
      if (error) return { status: "error", message: t("saveError") };
      postId = data.id;
    }

    // photos (optional): normalised server-side, EXIF stripped, blurhash placeholder
    const files = formData
      .getAll("media")
      .filter((f): f is File => f instanceof File && f.size > 0);
    const tagged = formData
      .getAll("taggedStudentIds")
      .map(String)
      .filter((id) => uuid.test(id));
    const consent = formData.get("consent") === "on";
    if (files.length > 0 && !consent) return { status: "error", message: t("consentRequired") };
    let index = 0;
    for (const file of files.slice(0, 20)) {
      if (file.size > MAX_UPLOAD_BYTES || !IMAGE_MIME_TYPES.has(file.type)) continue;
      const image = await processImage(Buffer.from(await file.arrayBuffer()));
      const path = `${cls.school_id}/${parsed.data.classId}/${postId}/${safeFileName(file.name).replace(/\.[^.]+$/, "")}.webp`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKETS.classMedia)
        .upload(path, image.buffer, { contentType: image.contentType, upsert: false });
      if (uploadError) return { status: "error", message: t("uploadError") };
      const { error: mediaError } = await supabase.from("class_post_media").insert({
        post_id: postId,
        storage_path: path,
        kind: "image",
        width: image.width,
        height: image.height,
        blurhash: image.blurhash,
        consent_checked: consent,
        tagged_student_ids: tagged,
        sort_order: index++,
      });
      if (mediaError) {
        await supabase.storage.from(BUCKETS.classMedia).remove([path]);
        return {
          status: "error",
          message: mediaError.message.includes("Droit à l'image")
            ? t("imageRightsBlocked")
            : t("saveError"),
        };
      }
    }

    if (parsed.data.publish) await supabase.rpc("notify_due_content");
    revalidatePath(`/classes/${parsed.data.classId}`, "layout");
    revalidatePath("/accueil");
    return {
      status: "success",
      message: parsed.data.id ? t("editSaved") : parsed.data.publish ? t("published") : t("saved"),
      postId,
    };
  } catch (error) {
    return toActionError(error);
  }
}
