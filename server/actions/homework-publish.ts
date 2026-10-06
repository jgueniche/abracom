"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/auth/session";
import { mondayOf } from "@/lib/calendar/dates";
import { PAGE_IMAGE_EDGE } from "@/lib/media";
import { isSchoolStaff } from "@/lib/permissions";
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
 * Publishing a homework (ADR-0070, ADR-0071). Lives beside `class-post-publish.ts` for the
 * reason that one gives: it is the only kind of action that needs `sharp`, so only the composer
 * route carries it (ADR-0066).
 *
 * The files are already in Storage when this runs — the browser wrote them the moment they
 * were chosen — so the request is a few hundred bytes whatever the number of pages, and the
 * action's work is to check them, normalise the photos, and write the rows.
 */

const homeworkSchema = z.object({
  postId: z.string().regex(uuid),
  editing: z.boolean(),
  classId: z.string().regex(uuid),
  title: z.string().trim().min(1).max(200),
  bodyMd: z.string().max(20000),
  subject: z.string().trim().max(60).nullable(),
  dueOn: z.iso.date(),
  visibility: z.enum(["parents", "staff"]),
  publish: z.boolean(),
  keep: z.array(z.string().regex(uuid)).max(UPLOAD_LIMITS.classMedia.maxFiles),
  alsoFor: z.array(z.string().regex(uuid)).max(12),
  returnTo: z.enum(["devoirs", "classe"]),
});

export type HomeworkFormState = ActionState & {
  postId?: string;
  /** Where the composer goes once the homework is saved. */
  href?: string;
  field?: "title" | "dueOn";
};

export async function saveHomework(
  _prev: HomeworkFormState,
  formData: FormData,
): Promise<HomeworkFormState> {
  try {
    const t = await getTranslations("homeworkComposer");
    const user = await requireCurrentUser();
    const parsed = homeworkSchema.safeParse({
      postId: field(formData, "postId"),
      editing: formData.get("editing") === "true",
      classId: field(formData, "classId"),
      title: field(formData, "title"),
      bodyMd: String(formData.get("bodyMd") ?? ""),
      subject: optional(formData, "subject"),
      dueOn: field(formData, "dueOn"),
      visibility: field(formData, "visibility") || "parents",
      publish: formData.get("intent") !== "draft",
      keep: formData.getAll("keep").map(String),
      alsoFor: formData.getAll("alsoFor").map(String),
      returnTo: field(formData, "returnTo") === "devoirs" ? "devoirs" : "classe",
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.path[0];
      if (issue === "dueOn") return { status: "error", message: t("dueRequired"), field: "dueOn" };
      if (issue === "title")
        return { status: "error", message: t("titleRequired"), field: "title" };
      return { status: "error", message: t("invalid") };
    }
    const input = parsed.data;
    const uploads = parseUploadList(formData.get("uploads"), classUploadSchema);
    if (input.keep.length + uploads.length > UPLOAD_LIMITS.classMedia.maxFiles)
      return { status: "error", message: t("tooManyFiles") };

    const supabase = await createClient();
    const { data: cls } = await supabase
      .from("classes")
      .select("school_id, class_teachers ( user_id )")
      .eq("id", input.classId)
      .maybeSingle();
    if (!cls) return { status: "error", message: t("saveError") };
    const staff = isSchoolStaff(user.roles, cls.school_id);
    if (!staff && !cls.class_teachers.some((row) => row.user_id === user.id))
      return { status: "error", message: t("notAllowed") };

    let existing: {
      published_at: string | null;
      media: { id: string; storage_path: string; thumb_path: string | null }[];
    } | null = null;
    if (input.editing) {
      const { data } = await supabase
        .from("class_posts")
        .select("type, published_at, media:class_post_media ( id, storage_path, thumb_path )")
        .eq("id", input.postId)
        .eq("class_id", input.classId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!data || data.type !== "homework") return { status: "error", message: t("saveError") };
      existing = data;
    }

    // 1. The files, before anything is written to the table: a refusal leaves no half-post.
    const folder = classMediaFolder(cls.school_id, input.classId, input.postId);
    let stored: StoredMedia[];
    try {
      stored = await finalizeClassUploads(supabase, folder, uploads, { maxEdge: PAGE_IMAGE_EDGE });
    } catch (error) {
      if (error instanceof UploadRejected)
        return { status: "error", message: t(`upload.${error.reason}`) };
      throw error;
    }
    const writtenPaths = stored.flatMap((media) =>
      media.thumb_path ? [media.storage_path, media.thumb_path] : [media.storage_path],
    );
    const undoFiles = async () => {
      if (writtenPaths.length > 0)
        await supabase.storage.from(BUCKETS.classMedia).remove(writtenPaths);
    };

    // 2. The homework itself.
    const publishedAt = input.publish ? (existing?.published_at ?? new Date().toISOString()) : null;
    const values = {
      type: "homework" as const,
      title: input.title,
      body_md: input.bodyMd,
      subject: input.subject,
      due_on: input.dueOn,
      visibility: input.visibility,
      published_at: publishedAt,
    };
    if (existing) {
      const { data: updated, error } = await supabase
        .from("class_posts")
        .update(values)
        .eq("id", input.postId)
        .select("id");
      if (error || !updated?.length) {
        await undoFiles();
        return { status: "error", message: t(error ? "saveError" : "notAuthor") };
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

    // 3. The files of the homework: what was taken off goes, the rest keeps its order, the new
    //    ones follow.
    if (existing) {
      const dropped = existing.media.filter((media) => !input.keep.includes(media.id));
      if (dropped.length > 0) {
        await supabase
          .from("class_post_media")
          .delete()
          .in(
            "id",
            dropped.map((media) => media.id),
          );
        await supabase.storage
          .from(BUCKETS.classMedia)
          .remove(
            dropped.flatMap((media) =>
              media.thumb_path ? [media.storage_path, media.thumb_path] : [media.storage_path],
            ),
          );
      }
      const kept = input.keep.filter((id) => existing.media.some((media) => media.id === id));
      await Promise.all(
        kept.map((id, index) =>
          supabase.from("class_post_media").update({ sort_order: index }).eq("id", id),
        ),
      );
    }
    const offset = input.keep.length;
    if (stored.length > 0) {
      const { error } = await supabase.from("class_post_media").insert(
        stored.map((media, index) => ({
          ...media,
          post_id: input.postId,
          sort_order: offset + index,
        })),
      );
      if (error) {
        await undoFiles();
        return { status: "error", message: t("upload.process") };
      }
    }

    // 4. The same homework for the teacher's other classes — a specialist gives the same
    //    lesson to three CE1 groups and used to type it three times.
    const copiedTo: string[] = [];
    const failedFor: string[] = [];
    if (!existing && input.alsoFor.length > 0) {
      const targets = input.alsoFor.filter((id) => id !== input.classId);
      const { data: classes } = await supabase
        .from("classes")
        .select("id, name, school_id, class_teachers ( user_id )")
        .in("id", targets);
      for (const target of classes ?? []) {
        const allowed =
          target.school_id === cls.school_id &&
          (staff || target.class_teachers.some((row) => row.user_id === user.id));
        if (!allowed) {
          failedFor.push(target.name);
          continue;
        }
        const copied = await copyHomework(supabase, {
          values,
          media: stored,
          from: folder,
          schoolId: cls.school_id,
          classId: target.id,
          authorId: user.id,
        });
        (copied ? copiedTo : failedFor).push(target.name);
      }
    }

    if (input.publish) await supabase.rpc("notify_due_content");
    revalidatePath("/devoirs", "layout");
    revalidatePath(`/classes/${input.classId}`, "layout");
    for (const id of input.alsoFor) revalidatePath(`/classes/${id}`, "layout");
    revalidatePath("/accueil");

    const week = mondayOf(input.dueOn);
    const href =
      input.returnTo === "devoirs"
        ? `/devoirs?semaine=${week}#devoir-${input.postId}`
        : `/classes/${input.classId}/devoirs?semaine=${week}#devoir-${input.postId}`;
    const message = existing
      ? t("updated")
      : input.publish
        ? copiedTo.length > 0
          ? t("publishedMany", { count: copiedTo.length + 1 })
          : t("published")
        : t("savedDraft");
    return {
      status: "success",
      message:
        failedFor.length > 0
          ? `${message} ${t("copyFailed", { classes: failedFor.join(", ") })}`
          : message,
      postId: input.postId,
      href,
    };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * One copy of a homework in another class: its own row, and its own files — copied inside the
 * bucket, never sent again — under the other class's folder, which is what that class's
 * families are allowed to read.
 */
async function copyHomework(
  supabase: Awaited<ReturnType<typeof createClient>>,
  options: {
    values: {
      type: "homework";
      title: string;
      body_md: string;
      subject: string | null;
      due_on: string;
      visibility: "parents" | "staff";
      published_at: string | null;
    };
    media: StoredMedia[];
    from: string;
    schoolId: string;
    classId: string;
    authorId: string;
  },
): Promise<boolean> {
  const postId = globalThis.crypto.randomUUID();
  const folder = classMediaFolder(options.schoolId, options.classId, postId);
  const bucket = supabase.storage.from(BUCKETS.classMedia);
  const copies: StoredMedia[] = [];
  const written: string[] = [];
  for (const media of options.media) {
    const move = (path: string) => `${folder}/${path.slice(options.from.length + 1)}`;
    const main = move(media.storage_path);
    const { error } = await bucket.copy(media.storage_path, main);
    if (error) {
      if (written.length > 0) await bucket.remove(written);
      return false;
    }
    written.push(main);
    let thumb: string | null = null;
    if (media.thumb_path) {
      thumb = move(media.thumb_path);
      const { error: thumbError } = await bucket.copy(media.thumb_path, thumb);
      if (thumbError) thumb = null;
      else written.push(thumb);
    }
    copies.push({ ...media, storage_path: main, thumb_path: thumb });
  }
  const { error } = await supabase.from("class_posts").insert({
    ...options.values,
    id: postId,
    class_id: options.classId,
    school_id: options.schoolId,
    author_id: options.authorId,
  });
  if (error) {
    if (written.length > 0) await bucket.remove(written);
    return false;
  }
  if (copies.length > 0) {
    const { error: mediaError } = await supabase
      .from("class_post_media")
      .insert(copies.map((media, index) => ({ ...media, post_id: postId, sort_order: index })));
    if (mediaError) return false;
  }
  return true;
}
