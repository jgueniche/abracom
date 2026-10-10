"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  revalidatePath("/devoirs", "layout");
  // Deleting from the homework's own page: that page no longer exists, go back to the week.
  const next = field(formData, "next");
  if (/^\/devoirs(\?[\w=&-]*)?$/.test(next)) redirect(next);
}

export async function deletePostMedia(formData: FormData): Promise<void> {
  await requireCurrentUser();
  const mediaId = field(formData, "mediaId");
  if (!uuid.test(mediaId)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_post_media")
    .select("id, storage_path, thumb_path, post:class_posts ( class_id )")
    .eq("id", mediaId)
    .maybeSingle();
  if (!data) return;
  await supabase.storage
    .from(BUCKETS.classMedia)
    .remove(data.thumb_path ? [data.storage_path, data.thumb_path] : [data.storage_path]);
  await supabase.from("class_post_media").delete().eq("id", mediaId);
  if (data.post) revalidatePath(`/classes/${data.post.class_id}`, "layout");
  revalidatePath("/devoirs", "layout");
}

/**
 * « Fait » — a parent ticks a homework for one of their children, or unticks it.
 *
 * Called straight from the diary's toggle, which has already drawn the tick: the answer only
 * says whether the database agreed. The RLS decide who may tick (a guardian of the child who may
 * write in the school — never a read-only guardian), so a refusal arrives here as zero rows.
 */
export async function setHomeworkDone(input: {
  postId: string;
  studentId: string;
  done: boolean;
}): Promise<{ ok: boolean }> {
  const user = await requireCurrentUser();
  if (!uuid.test(input.postId) || !uuid.test(input.studentId)) return { ok: false };
  const supabase = await createClient();
  if (input.done) {
    const { error } = await supabase
      .from("homework_completions")
      .upsert(
        { post_id: input.postId, student_id: input.studentId, marked_by_user_id: user.id },
        { onConflict: "post_id,student_id", ignoreDuplicates: true },
      );
    if (error) return { ok: false };
  } else {
    const { data, error } = await supabase
      .from("homework_completions")
      .delete()
      .eq("post_id", input.postId)
      .eq("student_id", input.studentId)
      .select("post_id");
    if (error) return { ok: false };
    if (!data?.length) {
      // Nothing deleted: either there was nothing to untick, or the policy said no — and a
      // refusal must not leave the toggle showing a state the database does not hold.
      const { count } = await supabase
        .from("homework_completions")
        .select("post_id", { count: "exact", head: true })
        .eq("post_id", input.postId)
        .eq("student_id", input.studentId);
      if (count) return { ok: false };
    }
  }
  // The diary's own render comes back with this answer; the other screens that count
  // completions are invalidated for the next visit.
  revalidatePath("/devoirs", "layout");
  revalidatePath("/classes", "layout");
  return { ok: true };
}
