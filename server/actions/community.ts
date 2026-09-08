"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { assertSchoolContext } from "@/lib/auth/guards";
import { requireCurrentUser } from "@/lib/auth/session";
import { zonedToUtc } from "@/lib/calendar/dates";
import { TIME_ZONE } from "@/lib/i18n/config";
import { canWriteInSchool, ForbiddenError, hasSchoolRole, isSchoolStaff } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";
import { FORM_FIELD_TYPES, type FormField, type FormFieldType, parseFormSchema } from "@/lib/forms";
import { COMMUNITY_CATEGORIES } from "@/server/queries/community";

import { type ActionState, field, optional, toActionError, uuid } from "./admin/_shared";

function dbMessage(error: { code?: string; message: string }, fallback: string): string {
  return error.code === "23514" ? error.message : fallback;
}

// ── directory ────────────────────────────────────────────────────────────────

export async function saveDirectorySettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("community.directory");
    const user = await requireCurrentUser();
    const schoolId = user.school?.id;
    if (!schoolId) throw new ForbiddenError();
    const address = optional(formData, "address");
    if (address && address.length > 300) return { status: "error", message: t("invalid") };
    const supabase = await createClient();
    const { error } = await supabase.from("directory_optins").upsert(
      {
        user_id: user.id,
        school_id: schoolId,
        show_phone: formData.get("showPhone") === "on",
        show_email: formData.get("showEmail") === "on",
        show_children_names: formData.get("showChildren") === "on",
        show_address: formData.get("showAddress") === "on",
        address,
        show_birthday: formData.get("showBirthday") === "on",
      },
      { onConflict: "user_id,school_id" },
    );
    if (error) return { status: "error", message: t("saveError") };
    revalidatePath("/communaute", "layout");
    return { status: "success", message: t("saved") };
  } catch (error) {
    return toActionError(error);
  }
}

// ── classifieds ──────────────────────────────────────────────────────────────

const classifiedSchema = z.object({
  category: z.enum(COMMUNITY_CATEGORIES),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(5000),
});

export type ClassifiedState = ActionState & { id?: string };

export async function createClassified(
  _prev: ClassifiedState,
  formData: FormData,
): Promise<ClassifiedState> {
  try {
    const t = await getTranslations("community.classifieds");
    const user = await requireCurrentUser();
    const schoolId = user.school?.id;
    if (!schoolId || !canWriteInSchool(user.roles, schoolId)) throw new ForbiddenError();
    const parsed = classifiedSchema.safeParse({
      category: field(formData, "category"),
      title: field(formData, "title"),
      body: String(formData.get("body") ?? ""),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("community_posts")
      .insert({ school_id: schoolId, author_id: user.id, ...parsed.data })
      .select("id, status")
      .single();
    if (error) return { status: "error", message: t("saveError") };
    revalidatePath("/communaute", "layout");
    revalidatePath("/admin/communaute");
    redirect(`/communaute/annonces/${data.id}`);
  } catch (error) {
    return toActionError(error);
  }
}

export async function archiveClassified(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const id = field(formData, "id");
  if (!uuid.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("community_posts")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("author_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/communaute", "layout");
  redirect("/communaute/annonces");
}

/** Staff: approve / reject / archive (a-priori moderation, audited). */
export async function moderateClassified(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin", "staff"]);
  const id = field(formData, "id");
  const decision = field(formData, "decision");
  if (!uuid.test(id) || !["published", "rejected", "archived"].includes(decision)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("community_posts")
    .update({
      status: decision as "published" | "rejected" | "archived",
      moderated_by: user.id,
      moderated_at: new Date().toISOString(),
      ...(decision === "published"
        ? { expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() }
        : {}),
    })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "community.moderate",
    entity: "community_posts",
    entityId: id,
    diff: { decision },
  });
  revalidatePath("/communaute", "layout");
  revalidatePath("/admin/communaute");
}

// ── appointments ─────────────────────────────────────────────────────────────

const slotsSchema = z.object({
  classId: z.string().regex(uuid),
  date: z.iso.date(),
  from: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  to: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration: z.coerce.number().int().min(5).max(120),
  location: z.string().trim().max(120).nullable(),
});

export async function createAppointmentSlots(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("community.appointments");
    const user = await requireCurrentUser();
    const schoolId = user.school?.id;
    if (!schoolId || !hasSchoolRole(user.roles, schoolId, ["teacher", "school_admin", "staff"])) {
      throw new ForbiddenError();
    }
    const parsed = slotsSchema.safeParse({
      classId: field(formData, "classId"),
      date: field(formData, "date"),
      from: field(formData, "from"),
      to: field(formData, "to"),
      duration: field(formData, "duration") || "15",
      location: optional(formData, "location"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };
    const start = zonedToUtc(`${parsed.data.date}T${parsed.data.from}`, TIME_ZONE).getTime();
    const end = zonedToUtc(`${parsed.data.date}T${parsed.data.to}`, TIME_ZONE).getTime();
    const step = parsed.data.duration * 60_000;
    if (end <= start || (end - start) / step > 40)
      return { status: "error", message: t("invalid") };
    const rows = [];
    for (let at = start; at + step <= end; at += step) {
      rows.push({
        school_id: schoolId,
        class_id: parsed.data.classId,
        teacher_id: user.id,
        starts_at: new Date(at).toISOString(),
        ends_at: new Date(at + step).toISOString(),
        location: parsed.data.location,
      });
    }
    const supabase = await createClient();
    const { error } = await supabase.from("appointment_slots").insert(rows);
    if (error) return { status: "error", message: t("saveError") };
    revalidatePath(`/classes/${parsed.data.classId}/rdv`);
    return { status: "success", message: t("created", { count: rows.length }) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteAppointmentSlot(formData: FormData): Promise<void> {
  await requireCurrentUser();
  const id = field(formData, "id");
  const classId = field(formData, "classId");
  if (!uuid.test(id) || !uuid.test(classId)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointment_slots")
    .delete()
    .eq("id", id)
    .is("booked_by", null);
  if (error) throw new Error(error.message);
  revalidatePath(`/classes/${classId}/rdv`);
}

export async function bookAppointment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("community.appointments");
    await requireCurrentUser();
    const slotId = field(formData, "slotId");
    const studentId = field(formData, "studentId");
    const classId = field(formData, "classId");
    if (!uuid.test(slotId) || !uuid.test(studentId) || !uuid.test(classId)) {
      return { status: "error", message: t("invalid") };
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("book_appointment", { slot: slotId, student: studentId });
    if (error) {
      return {
        status: "error",
        message: error.code === "42501" ? t("forbidden") : dbMessage(error, t("bookError")),
      };
    }
    revalidatePath(`/classes/${classId}/rdv`);
    return { status: "success", message: t("booked") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function cancelAppointment(formData: FormData): Promise<void> {
  await requireCurrentUser();
  const slotId = field(formData, "slotId");
  const classId = field(formData, "classId");
  if (!uuid.test(slotId) || !uuid.test(classId)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_appointment", { slot: slotId });
  if (error) throw new Error(error.message);
  revalidatePath(`/classes/${classId}/rdv`);
}

// ── forms (staff builder, family answers) ────────────────────────────────────

const formSchema = z.object({
  id: z.string().regex(uuid).nullable(),
  title: z.string().trim().min(1).max(200),
  descriptionMd: z.string().max(5000).nullable(),
  audience: z.enum(["school", "level", "class", "custom"]),
  targetIds: z.array(z.string().regex(uuid)),
  perStudent: z.boolean(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
});

export type FormBuilderState = ActionState & { id?: string };

function slugId(label: string, index: number): string {
  const base = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30);
  return `${base || "champ"}_${index + 1}`;
}

/** Fields come as parallel inputs: fieldLabel[], fieldType[], fieldRequired[] ("1"/"0"), fieldOptions[]. */
function parseFields(formData: FormData, existing: FormField[]): FormField[] | null {
  const labels = formData.getAll("fieldLabel").map(String);
  const types = formData.getAll("fieldType").map(String);
  const required = formData.getAll("fieldRequired").map(String);
  const options = formData.getAll("fieldOptions").map(String);
  const fields: FormField[] = [];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]!.trim();
    if (!label) continue;
    const type = types[i] as FormFieldType;
    if (!FORM_FIELD_TYPES.includes(type) || label.length > 200) return null;
    const previous = existing[i];
    const opts = (options[i] ?? "")
      .split(/\r?\n|;/)
      .map((o) => o.trim())
      .filter(Boolean)
      .slice(0, 20);
    if ((type === "choice" || type === "multi") && opts.length < 2) return null;
    fields.push({
      id: previous?.id ?? slugId(label, i),
      type,
      label,
      required: required[i] === "1",
      options: type === "choice" || type === "multi" ? opts : undefined,
    });
  }
  return fields.length > 0 && fields.length <= 30 ? fields : null;
}

function toIso(local: string | null): string | null {
  if (!local) return null;
  const date = zonedToUtc(local, TIME_ZONE);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function saveForm(
  _prev: FormBuilderState,
  formData: FormData,
): Promise<FormBuilderState> {
  try {
    const t = await getTranslations("community.forms");
    const { user, schoolId } = await assertSchoolContext(["school_admin", "staff"]);
    const parsed = formSchema.safeParse({
      id: optional(formData, "id"),
      title: field(formData, "title"),
      descriptionMd: optional(formData, "descriptionMd"),
      audience: field(formData, "audience") || "school",
      targetIds: formData.getAll("targetIds").map(String).filter(Boolean),
      perStudent: formData.get("perStudent") === "on",
      opensAt: optional(formData, "opensAt"),
      closesAt: optional(formData, "closesAt"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };
    if (parsed.data.audience !== "school" && parsed.data.targetIds.length === 0) {
      return { status: "error", message: t("targetsRequired") };
    }
    const supabase = await createClient();
    let existing: FormField[] = [];
    if (parsed.data.id) {
      const { data } = await supabase
        .from("forms")
        .select("schema")
        .eq("id", parsed.data.id)
        .maybeSingle();
      existing = parseFormSchema(data?.schema);
    }
    const fields = parseFields(formData, existing);
    if (!fields) return { status: "error", message: t("fieldsInvalid") };

    const values = {
      school_id: schoolId,
      title: parsed.data.title,
      description_md: parsed.data.descriptionMd,
      schema: { fields },
      audience: parsed.data.audience,
      target_ids: parsed.data.audience === "school" ? [] : parsed.data.targetIds,
      per_student: parsed.data.perStudent,
      opens_at: toIso(parsed.data.opensAt),
      closes_at: toIso(parsed.data.closesAt),
    };
    let id = parsed.data.id;
    if (id) {
      const { error } = await supabase
        .from("forms")
        .update(values)
        .eq("id", id)
        .eq("school_id", schoolId);
      if (error) return { status: "error", message: t("saveError") };
    } else {
      const { data, error } = await supabase
        .from("forms")
        .insert({ ...values, created_by: user.id })
        .select("id")
        .single();
      if (error) return { status: "error", message: t("saveError") };
      id = data.id;
    }
    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: parsed.data.id ? "form.update" : "form.create",
      entity: "forms",
      entityId: id,
      diff: { audience: parsed.data.audience, fields: fields.length },
    });
    await supabase.rpc("notify_due_forms");
    revalidatePath("/communaute", "layout");
    revalidatePath("/admin/formulaires", "layout");
    if (!parsed.data.id) redirect(`/admin/formulaires/${id}`);
    return { status: "success", message: t("saved"), id };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteForm(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin", "staff"]);
  const id = field(formData, "id");
  if (!uuid.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("forms")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error(error.message);
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "form.delete",
    entity: "forms",
    entityId: id,
  });
  revalidatePath("/communaute", "layout");
  revalidatePath("/admin/formulaires", "layout");
  redirect("/admin/formulaires");
}

/** Validates the answers against the stored schema and stores one response per (form, user, child). */
export async function submitFormResponse(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("community.forms");
    const user = await requireCurrentUser();
    const formId = field(formData, "formId");
    const studentId = optional(formData, "studentId");
    if (!uuid.test(formId) || (studentId && !uuid.test(studentId))) {
      return { status: "error", message: t("invalid") };
    }
    const supabase = await createClient();
    const { data: form } = await supabase
      .from("forms")
      .select("id, schema, per_student, closes_at")
      .eq("id", formId)
      .maybeSingle();
    if (!form) return { status: "error", message: t("invalid") };
    if (form.closes_at && new Date(form.closes_at).getTime() <= Date.now()) {
      return { status: "error", message: t("closed") };
    }
    if (form.per_student && !studentId) return { status: "error", message: t("childRequired") };

    const answers: Record<string, string | number | boolean | null | string[]> = {};
    for (const f of parseFormSchema(form.schema)) {
      const raw = formData.getAll(`answer:${f.id}`).map((v) => String(v).trim());
      const value = raw[0] ?? "";
      if (f.type === "multi") {
        const chosen = raw.filter((v) => f.options?.includes(v));
        if (f.required && chosen.length === 0)
          return { status: "error", message: t("required", { label: f.label }) };
        answers[f.id] = chosen;
        continue;
      }
      if (f.type === "yesno") {
        if (f.required && value !== "yes" && value !== "no") {
          return { status: "error", message: t("required", { label: f.label }) };
        }
        answers[f.id] = value === "yes" ? true : value === "no" ? false : null;
        continue;
      }
      if (f.required && value === "")
        return { status: "error", message: t("required", { label: f.label }) };
      if (f.type === "choice" && value !== "" && !f.options?.includes(value)) {
        return { status: "error", message: t("invalid") };
      }
      if (f.type === "number") {
        const numeric = value === "" ? null : Number(value);
        if (numeric !== null && !Number.isFinite(numeric)) {
          return { status: "error", message: t("invalid") };
        }
        answers[f.id] = numeric;
        continue;
      }
      answers[f.id] = value.slice(0, 2000);
    }

    let query = supabase
      .from("form_responses")
      .select("id")
      .eq("form_id", formId)
      .eq("user_id", user.id);
    query = studentId ? query.eq("student_id", studentId) : query.is("student_id", null);
    const { data: previous } = await query.maybeSingle();
    const { error } = previous
      ? await supabase
          .from("form_responses")
          .update({ answers, submitted_at: new Date().toISOString() })
          .eq("id", previous.id)
      : await supabase
          .from("form_responses")
          .insert({ form_id: formId, user_id: user.id, student_id: studentId, answers });
    if (error) return { status: "error", message: t("saveError") };
    revalidatePath(`/communaute/formulaires/${formId}`);
    revalidatePath("/communaute/formulaires");
    return { status: "success", message: t("submitted") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function isStaffUser(): Promise<boolean> {
  const user = await requireCurrentUser();
  return user.school !== null && isSchoolStaff(user.roles, user.school.id);
}
