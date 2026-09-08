"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/auth/session";
import { IMAGE_MIME_TYPES, processImage } from "@/lib/media";
import { BUCKETS, MAX_UPLOAD_BYTES, safeFileName } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { type ActionState, field, optional, toActionError, uuid } from "./admin/_shared";

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

/** Teachers publish typed posts (homework, journal, info, reminder) in their classes. */
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

    const values = {
      type: parsed.data.type,
      title: parsed.data.title,
      body_md: parsed.data.bodyMd,
      subject: parsed.data.subject,
      due_on: parsed.data.dueOn,
      visibility: parsed.data.visibility,
      published_at: parsed.data.publish ? new Date().toISOString() : null,
    };
    let postId = parsed.data.id;
    if (postId) {
      const { error } = await supabase.from("class_posts").update(values).eq("id", postId);
      if (error) return { status: "error", message: t("saveError") };
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
        consent_checked: tagged.length > 0,
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
      message: parsed.data.publish ? t("published") : t("saved"),
      postId,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteClassPost(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const postId = field(formData, "postId");
  if (!uuid.test(postId)) return;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("class_posts")
    .select("id, class_id, school_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return;
  const { error } = await supabase
    .from("class_posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    schoolId: post.school_id,
    actorId: user.id,
    action: "class_post.delete",
    entity: "class_posts",
    entityId: postId,
  });
  revalidatePath(`/classes/${post.class_id}`, "layout");
}

export async function deletePostMedia(formData: FormData): Promise<void> {
  await requireCurrentUser();
  const mediaId = field(formData, "mediaId");
  if (!uuid.test(mediaId)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_post_media")
    .select("id, storage_path, post:class_posts ( class_id )")
    .eq("id", mediaId)
    .maybeSingle();
  if (!data) return;
  await supabase.storage.from(BUCKETS.classMedia).remove([data.storage_path]);
  await supabase.from("class_post_media").delete().eq("id", mediaId);
  if (data.post) revalidatePath(`/classes/${data.post.class_id}`, "layout");
}

/** Parent ticks "vu" for a child (or a teacher on their behalf). */
export async function toggleHomeworkSeen(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const postId = field(formData, "postId");
  const studentId = field(formData, "studentId");
  const classId = field(formData, "classId");
  if (!uuid.test(postId) || !uuid.test(studentId)) return;
  const supabase = await createClient();
  const done = formData.get("done") === "true";
  if (done) {
    await supabase
      .from("homework_completions")
      .delete()
      .eq("post_id", postId)
      .eq("student_id", studentId);
  } else {
    await supabase
      .from("homework_completions")
      .upsert(
        { post_id: postId, student_id: studentId, marked_by_user_id: user.id },
        { onConflict: "post_id,student_id", ignoreDuplicates: true },
      );
  }
  if (uuid.test(classId)) revalidatePath(`/classes/${classId}`, "layout");
  revalidatePath("/accueil");
}
