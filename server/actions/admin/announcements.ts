"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { assertSchoolContext } from "@/lib/auth/guards";
import { attachmentPath, BUCKETS, DOCUMENT_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { type ActionState, field, optional, toActionError, uuid } from "./_shared";

const announcementSchema = z.object({
  id: z.string().regex(uuid).nullable(),
  title: z.string().trim().min(1).max(200),
  bodyMd: z.string().max(20000),
  titleEn: z.string().trim().max(200).nullable(),
  bodyMdEn: z.string().max(20000).nullable(),
  audience: z.enum(["school", "level", "class", "custom"]),
  targetIds: z.array(z.string().regex(uuid)),
  requiresAck: z.boolean(),
  pinned: z.boolean(),
  publishedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  documentId: z.string().regex(uuid).nullable(),
  template: z.string().max(40).nullable(),
});

function toIso(local: string | null): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export type AnnouncementFormState = ActionState & { id?: string };

/** Creates or updates an announcement; `intent` = save (draft) | publish (now) | schedule (keep date). */
export async function saveAnnouncement(
  _prev: AnnouncementFormState,
  formData: FormData,
): Promise<AnnouncementFormState> {
  try {
    const t = await getTranslations("adminAnnouncements");
    const { user, schoolId } = await assertSchoolContext(["school_admin", "staff"]);
    const intent = field(formData, "intent") || "save";
    const parsed = announcementSchema.safeParse({
      id: optional(formData, "id"),
      title: field(formData, "title"),
      bodyMd: String(formData.get("bodyMd") ?? ""),
      titleEn: optional(formData, "titleEn"),
      bodyMdEn: optional(formData, "bodyMdEn"),
      audience: field(formData, "audience"),
      targetIds: formData.getAll("targetIds").map(String).filter(Boolean),
      requiresAck: formData.get("requiresAck") === "on",
      pinned: formData.get("pinned") === "on",
      publishedAt: optional(formData, "publishedAt"),
      expiresAt: optional(formData, "expiresAt"),
      documentId: optional(formData, "documentId"),
      template: optional(formData, "template"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };
    if (parsed.data.audience !== "school" && parsed.data.targetIds.length === 0) {
      return { status: "error", message: t("targetsRequired") };
    }

    const publishedAt =
      intent === "publish"
        ? new Date().toISOString()
        : intent === "draft"
          ? null
          : toIso(parsed.data.publishedAt);
    const values = {
      school_id: schoolId,
      title: parsed.data.title,
      body_md: parsed.data.bodyMd,
      title_en: parsed.data.titleEn,
      body_md_en: parsed.data.bodyMdEn,
      audience: parsed.data.audience,
      target_ids: parsed.data.audience === "school" ? [] : parsed.data.targetIds,
      requires_ack: parsed.data.requiresAck,
      pinned: parsed.data.pinned,
      published_at: publishedAt,
      expires_at: toIso(parsed.data.expiresAt),
      document_id: parsed.data.documentId,
      template: parsed.data.template,
    };

    const supabase = await createClient();
    let id = parsed.data.id;
    if (id) {
      const { error } = await supabase
        .from("announcements")
        .update(values)
        .eq("id", id)
        .eq("school_id", schoolId);
      if (error) return { status: "error", message: t("saveError") };
    } else {
      const { data, error } = await supabase
        .from("announcements")
        .insert({ ...values, author_id: user.id })
        .select("id")
        .single();
      if (error) return { status: "error", message: t("saveError") };
      id = data.id;
    }

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: parsed.data.id ? "announcement.update" : "announcement.create",
      entity: "announcements",
      entityId: id,
      diff: { intent, audience: parsed.data.audience, publishedAt },
    });
    if (publishedAt && new Date(publishedAt).getTime() <= Date.now()) {
      await supabase.rpc("notify_due_content");
    }
    revalidatePath("/annonces");
    revalidatePath("/admin/annonces", "layout");
    if (!parsed.data.id) redirect(`/admin/annonces/${id}`);
    return { status: "success", message: intent === "publish" ? t("published") : t("saved"), id };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteAnnouncement(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin", "staff"]);
  const id = field(formData, "id");
  if (!uuid.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "announcement.delete",
    entity: "announcements",
    entityId: id,
  });
  revalidatePath("/annonces");
  revalidatePath("/admin/annonces", "layout");
  redirect("/admin/annonces");
}

export type RemindState = ActionState & { notified?: number };

/** One-click reminder for recipients who have not read / acknowledged. */
export async function remindNonReaders(
  _prev: RemindState,
  formData: FormData,
): Promise<RemindState> {
  try {
    const t = await getTranslations("adminAnnouncements");
    await assertSchoolContext(["school_admin", "staff"]);
    const id = field(formData, "id");
    if (!uuid.test(id)) return { status: "error", message: t("invalid") };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("remind_announcement", { announcement: id });
    if (error) return { status: "error", message: t("remindError") };
    revalidatePath(`/admin/annonces/${id}`);
    return { status: "success", message: t("reminded", { count: data ?? 0 }), notified: data ?? 0 };
  } catch (error) {
    return toActionError(error);
  }
}

export async function uploadAttachment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("adminAnnouncements");
    const { user, schoolId } = await assertSchoolContext(["school_admin", "staff"]);
    const id = field(formData, "id");
    const file = formData.get("file");
    if (!uuid.test(id) || !(file instanceof File) || file.size === 0)
      return { status: "error", message: t("fileRequired") };
    if (file.size > MAX_UPLOAD_BYTES) return { status: "error", message: t("fileTooLarge") };
    if (!DOCUMENT_MIME_TYPES.has(file.type)) return { status: "error", message: t("fileType") };

    const supabase = await createClient();
    const path = attachmentPath(schoolId, id, file.name);
    const { error: uploadError } = await supabase.storage
      .from(BUCKETS.attachments)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) return { status: "error", message: t("uploadError") };

    const { error } = await supabase.from("announcement_attachments").insert({
      announcement_id: id,
      storage_path: path,
      filename: file.name.slice(0, 200),
      size_bytes: file.size,
      mime: file.type,
    });
    if (error) return { status: "error", message: t("saveError") };

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "announcement.attach",
      entity: "announcement_attachments",
      entityId: id,
      diff: { filename: file.name },
    });
    revalidatePath(`/admin/annonces/${id}`);
    revalidatePath(`/annonces/${id}`);
    return { status: "success", message: t("attached") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteAttachment(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin", "staff"]);
  const attachmentId = field(formData, "attachmentId");
  if (!uuid.test(attachmentId)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcement_attachments")
    .select("id, storage_path, announcement_id")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!data) return;
  await supabase.storage.from(BUCKETS.attachments).remove([data.storage_path]);
  await supabase.from("announcement_attachments").delete().eq("id", attachmentId);
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "announcement.detach",
    entity: "announcement_attachments",
    entityId: data.announcement_id,
  });
  revalidatePath(`/admin/annonces/${data.announcement_id}`);
  revalidatePath(`/annonces/${data.announcement_id}`);
}
