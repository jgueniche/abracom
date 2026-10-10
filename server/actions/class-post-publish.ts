"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/auth/session";
import { MAX_IMAGE_EDGE } from "@/lib/media";
import { BUCKETS } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { finalizeClassUploads, type StoredMedia, UploadRejected } from "@/lib/uploads/server";
import {
  classMediaFolder,
  classUploadSchema,
  parseUploadList,
  UPLOAD_LIMITS,
} from "@/lib/uploads/shared";

import { type ActionState, field, optional, toActionError, uuid } from "./admin/_shared";

/**
 * Publishing lives apart from the rest of the class-post actions because it is the only one that
 * needs `processImage`, and so the only one that needs `sharp` — whose native libvips weighs 16 Mo.
 * A Server Action is bundled into every route that imports it, so while `saveClassPost` sat beside
 * `toggleHomeworkSeen`, screens that only read publications shipped libvips too: `/devoirs` and the
 * cahier de vie carried 21,75 Mo of function for a tick box (ADR-0066).
 *
 * Since session 33 the photos no longer travel in the request: the browser has written them to
 * the class folder before « Publier » is pressed (ADR-0071). The composer promised « jusqu'à 20
 * photos » while Next refused any request above 1 MB — three photos from a phone were enough to
 * make publishing fail.
 */

const postSchema = z.object({
  postId: z.string().regex(uuid),
  editing: z.boolean(),
  classId: z.string().regex(uuid),
  type: z.enum(["journal", "info", "reminder"]),
  title: z.string().trim().min(1).max(200),
  bodyMd: z.string().max(20000),
  subject: z.string().trim().max(60).nullable(),
  visibility: z.enum(["parents", "staff"]),
  publish: z.boolean(),
});

export type PostFormState = ActionState & { postId?: string };

/**
 * Teachers publish in their classes an entry of the cahier de vie, filed under one of its three
 * categories (journal, info, reminder). Homework has its own composer since session 33
 * (`homework-publish.ts`). Passing `editing` re-opens an existing publication — supported here
 * since session 5, reachable from the interface only since ADR-0059.
 */
export async function saveClassPost(
  _prev: PostFormState,
  formData: FormData,
): Promise<PostFormState> {
  try {
    const t = await getTranslations("classSpace.post");
    const user = await requireCurrentUser();
    const parsed = postSchema.safeParse({
      postId: field(formData, "postId"),
      editing: formData.get("editing") === "true",
      classId: field(formData, "classId"),
      type: field(formData, "type"),
      title: field(formData, "title"),
      bodyMd: String(formData.get("bodyMd") ?? ""),
      subject: optional(formData, "subject"),
      visibility: field(formData, "visibility") || "parents",
      publish: formData.get("intent") !== "draft",
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };
    const input = parsed.data;

    const uploads = parseUploadList(formData.get("uploads"), classUploadSchema).filter(
      (upload) => upload.kind === "image",
    );
    if (uploads.length > UPLOAD_LIMITS.classMedia.maxFiles * 2)
      return { status: "error", message: t("invalid") };
    const tagged = formData
      .getAll("taggedStudentIds")
      .map(String)
      .filter((id) => uuid.test(id));
    const consent = formData.get("consent") === "on";
    if (uploads.length > 0 && !consent) return { status: "error", message: t("consentRequired") };

    const supabase = await createClient();
    const { data: cls } = await supabase
      .from("classes")
      .select("school_id")
      .eq("id", input.classId)
      .maybeSingle();
    if (!cls) return { status: "error", message: t("saveError") };
    // The trigger refuses a tag without signed image rights; asking first means a refusal comes
    // before anything is written, not after the post exists without its photos.
    if (tagged.length > 0) {
      const { data: unsigned } = await supabase
        .from("students")
        .select("id")
        .in("id", tagged)
        .is("image_rights_signed_at", null);
      if (unsigned?.length) return { status: "error", message: t("imageRightsBlocked") };
    }

    let publishedAt: string | null = input.publish ? new Date().toISOString() : null;
    if (input.editing) {
      // only the author (or the direction, through RLS) edits a post; media follow the same rule
      const { data: existing } = await supabase
        .from("class_posts")
        .select("author_id, published_at")
        .eq("id", input.postId)
        .eq("class_id", input.classId)
        .maybeSingle();
      if (!existing) return { status: "error", message: t("saveError") };
      if (input.publish && existing.published_at) publishedAt = existing.published_at;
    }

    // Photos first: normalised server-side (EXIF stripped, 1 600 px, blurhash, thumbnail) — a
    // refusal leaves no post behind.
    const folder = classMediaFolder(cls.school_id, input.classId, input.postId);
    let stored: StoredMedia[];
    try {
      stored = await finalizeClassUploads(supabase, folder, uploads, { maxEdge: MAX_IMAGE_EDGE });
    } catch (error) {
      if (error instanceof UploadRejected) return { status: "error", message: t("uploadError") };
      throw error;
    }
    const undoFiles = async () => {
      const written = stored.flatMap((media) =>
        media.thumb_path ? [media.storage_path, media.thumb_path] : [media.storage_path],
      );
      if (written.length > 0) await supabase.storage.from(BUCKETS.classMedia).remove(written);
    };

    const values = {
      type: input.type,
      title: input.title,
      body_md: input.bodyMd,
      subject: input.subject,
      due_on: null,
      visibility: input.visibility,
      published_at: publishedAt,
    };
    if (input.editing) {
      const { data: updated, error } = await supabase
        .from("class_posts")
        .update(values)
        .eq("id", input.postId)
        .select("id");
      if (error || !updated?.length) {
        await undoFiles();
        return { status: "error", message: t("saveError") };
      }
    } else {
      const { error } = await supabase.from("class_posts").insert({
        ...values,
        id: input.postId,
        class_id: input.classId,
        school_id: cls.school_id,
        author_id: user.id,
      });
      if (error) {
        await undoFiles();
        return { status: "error", message: t("saveError") };
      }
    }

    if (stored.length > 0) {
      const { count } = await supabase
        .from("class_post_media")
        .select("id", { count: "exact", head: true })
        .eq("post_id", input.postId);
      const { error: mediaError } = await supabase.from("class_post_media").insert(
        stored.map((media, index) => ({
          ...media,
          post_id: input.postId,
          consent_checked: consent,
          tagged_student_ids: tagged,
          sort_order: (count ?? 0) + index,
        })),
      );
      if (mediaError) {
        await undoFiles();
        return {
          status: "error",
          message: mediaError.message.includes("Droit à l'image")
            ? t("imageRightsBlocked")
            : t("saveError"),
        };
      }
    }

    if (input.publish) await supabase.rpc("notify_due_content");
    revalidatePath(`/classes/${input.classId}`, "layout");
    revalidatePath("/accueil");
    return {
      status: "success",
      message: input.editing ? t("editSaved") : input.publish ? t("published") : t("saved"),
      postId: input.postId,
    };
  } catch (error) {
    return toActionError(error);
  }
}
