"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/auth/session";
import { BUCKETS, DOCUMENT_MIME_TYPES, MAX_UPLOAD_BYTES, safeFileName } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";

import { type ActionState, field, optional, toActionError, uuid } from "./admin/_shared";

const absenceSchema = z
  .object({
    studentId: z.string().regex(uuid),
    kind: z.enum(["absence", "late"]),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    reason: z.string().trim().max(500).nullable(),
  })
  .refine((v) => v.endsOn >= v.startsOn, { path: ["endsOn"] });

/** A guardian declares an absence or a late arrival, optionally with a justification file. */
export async function declareAbsence(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("classSpace.absences");
    const user = await requireCurrentUser();
    const startsOn = field(formData, "startsOn");
    const parsed = absenceSchema.safeParse({
      studentId: field(formData, "studentId"),
      kind: field(formData, "kind") || "absence",
      startsOn,
      endsOn: field(formData, "endsOn") || startsOn,
      reason: optional(formData, "reason"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { data: student } = await supabase
      .from("students")
      .select("school_id")
      .eq("id", parsed.data.studentId)
      .maybeSingle();
    if (!student) return { status: "error", message: t("saveError") };

    let justificationPath: string | null = null;
    const file = formData.get("justification");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES || !DOCUMENT_MIME_TYPES.has(file.type))
        return { status: "error", message: t("fileType") };
      justificationPath = `${student.school_id}/${parsed.data.studentId}/${safeFileName(file.name)}`;
      const { error } = await supabase.storage
        .from(BUCKETS.justifications)
        .upload(justificationPath, file, { contentType: file.type, upsert: false });
      if (error) return { status: "error", message: t("uploadError") };
    }

    const { error } = await supabase.from("absences").insert({
      school_id: student.school_id,
      student_id: parsed.data.studentId,
      declared_by: user.id,
      kind: parsed.data.kind,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      reason: parsed.data.reason,
      justification_path: justificationPath,
      status: "declared",
    });
    if (error) return { status: "error", message: t("saveError") };

    revalidatePath("/famille", "layout");
    return { status: "success", message: t("declared") };
  } catch (error) {
    return toActionError(error);
  }
}

/** Staff decides whether a declared absence is justified. */
export async function reviewAbsence(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const absenceId = field(formData, "absenceId");
  const status = field(formData, "status");
  if (!uuid.test(absenceId) || !["justified", "unjustified", "declared"].includes(status)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("absences")
    .update({
      status: status as "justified" | "unjustified" | "declared",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", absenceId)
    .select("school_id")
    .maybeSingle();
  if (data)
    await logAudit(supabase, {
      schoolId: data.school_id,
      actorId: user.id,
      action: `absence.${status}`,
      entity: "absences",
      entityId: absenceId,
    });
  revalidatePath("/classes", "layout");
  revalidatePath("/admin", "layout");
}
