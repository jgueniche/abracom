"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth/session";
import { BUCKETS } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { field, uuid } from "./admin/_shared";

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
  const { data: deleted, error } = await supabase
    .from("class_posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!deleted?.length) return;
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
  revalidatePath("/devoirs");
}
