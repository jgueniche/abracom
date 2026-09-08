"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { assertSchoolContext } from "@/lib/auth/guards";
import { BUCKETS, DOCUMENT_MIME_TYPES, documentPath, MAX_UPLOAD_BYTES } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { type ActionState, field, optional, toActionError, uuid } from "./_shared";

const documentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  descriptionMd: z.string().max(5000).nullable(),
  folderId: z.string().regex(uuid).nullable(),
  newFolder: z.string().trim().max(80).nullable(),
  audience: z.enum(["school", "level", "class", "custom"]),
  targetIds: z.array(z.string().regex(uuid)),
  requiresSignature: z.boolean(),
  signaturePerStudent: z.boolean(),
  purpose: z.enum(["generic", "image_rights", "outing_authorization", "charter"]),
  publishNow: z.boolean(),
});

/** Upload + metadata in one step (file first, then the row pointing at it). */
export async function createDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.documents");
    const { user, schoolId } = await assertSchoolContext(["school_admin", "staff"]);
    const parsed = documentSchema.safeParse({
      title: field(formData, "title"),
      descriptionMd: optional(formData, "descriptionMd"),
      folderId: optional(formData, "folderId"),
      newFolder: optional(formData, "newFolder"),
      audience: field(formData, "audience"),
      targetIds: formData.getAll("targetIds").map(String).filter(Boolean),
      requiresSignature: formData.get("requiresSignature") === "on",
      signaturePerStudent: formData.get("signaturePerStudent") === "on",
      purpose: field(formData, "purpose") || "generic",
      publishNow: formData.get("publishNow") === "on",
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };
    if (parsed.data.audience !== "school" && parsed.data.targetIds.length === 0)
      return { status: "error", message: t("targetsRequired") };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0)
      return { status: "error", message: t("fileRequired") };
    if (file.size > MAX_UPLOAD_BYTES) return { status: "error", message: t("fileTooLarge") };
    if (!DOCUMENT_MIME_TYPES.has(file.type)) return { status: "error", message: t("fileType") };

    const supabase = await createClient();
    let folderId = parsed.data.folderId;
    if (!folderId && parsed.data.newFolder) {
      const { data: folder, error } = await supabase
        .from("document_folders")
        .insert({ school_id: schoolId, name: parsed.data.newFolder, sort_order: 99 })
        .select("id")
        .single();
      if (error && error.code !== "23505") return { status: "error", message: t("saveError") };
      folderId = folder?.id ?? null;
    }

    const documentId = crypto.randomUUID();
    const path = documentPath(schoolId, documentId, file.name);
    const { error: uploadError } = await supabase.storage
      .from(BUCKETS.documents)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) return { status: "error", message: t("uploadError") };

    const { error } = await supabase.from("documents").insert({
      id: documentId,
      school_id: schoolId,
      folder_id: folderId,
      title: parsed.data.title,
      description_md: parsed.data.descriptionMd,
      storage_path: path,
      mime: file.type,
      size_bytes: file.size,
      audience: parsed.data.audience,
      target_ids: parsed.data.audience === "school" ? [] : parsed.data.targetIds,
      requires_signature: parsed.data.requiresSignature,
      signature_per_student: parsed.data.requiresSignature && parsed.data.signaturePerStudent,
      purpose: parsed.data.purpose,
      published_at: parsed.data.publishNow ? new Date().toISOString() : null,
      created_by: user.id,
    });
    if (error) {
      await supabase.storage.from(BUCKETS.documents).remove([path]);
      return { status: "error", message: t("saveError") };
    }

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "document.create",
      entity: "documents",
      entityId: documentId,
      diff: { title: parsed.data.title, purpose: parsed.data.purpose },
    });
    revalidatePath("/documents");
    revalidatePath("/admin/documents", "layout");
    return { status: "success", message: t("created") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function publishDocument(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin", "staff"]);
  const id = field(formData, "id");
  if (!uuid.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ published_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "document.publish",
    entity: "documents",
    entityId: id,
  });
  revalidatePath("/documents");
  revalidatePath("/admin/documents", "layout");
}

export async function deleteDocument(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin"]);
  const id = field(formData, "id");
  if (!uuid.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "document.delete",
    entity: "documents",
    entityId: id,
  });
  revalidatePath("/documents");
  revalidatePath("/admin/documents", "layout");
  redirect("/admin/documents");
}
