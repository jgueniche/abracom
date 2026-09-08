"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { assertSchoolContext } from "@/lib/auth/guards";
import { RELATIONS } from "@/lib/import/families";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";
import { ensureAccount, ensureMembership } from "@/server/actions/admin/accounts";

import { type ActionState, field, optional, toActionError, uuid } from "./_shared";

const studentSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  birthDate: z.iso.date().nullable(),
  allergiesNote: z.string().trim().max(500).nullable(),
  classId: z.string().regex(uuid).nullable(),
});

export async function createStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.students");
    const { user, schoolId } = await assertSchoolContext(["school_admin", "staff"]);
    const parsed = studentSchema.safeParse({
      firstName: field(formData, "firstName"),
      lastName: field(formData, "lastName"),
      birthDate: optional(formData, "birthDate"),
      allergiesNote: optional(formData, "allergiesNote"),
      classId: optional(formData, "classId"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("students")
      .insert({
        school_id: schoolId,
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        birth_date: parsed.data.birthDate,
        allergies_note: parsed.data.allergiesNote,
      })
      .select("id")
      .single();
    if (error) return { status: "error", message: t("saveError") };

    if (parsed.data.classId) {
      const enrolled = await enroll(supabase, schoolId, data.id, parsed.data.classId);
      if (!enrolled) return { status: "error", message: t("enrollError") };
    }
    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "student.create",
      entity: "students",
      entityId: data.id,
      diff: { name: `${parsed.data.firstName} ${parsed.data.lastName}` },
    });
    revalidatePath("/admin", "layout");
    return { status: "success", message: t("created") };
  } catch (error) {
    return toActionError(error);
  }
}

const updateSchema = studentSchema.omit({ classId: true }).extend({
  studentId: z.string().regex(uuid),
  status: z.enum(["active", "left", "archived"]),
});

export async function updateStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.students");
    const { user, schoolId } = await assertSchoolContext(["school_admin", "staff"]);
    const parsed = updateSchema.safeParse({
      studentId: field(formData, "studentId"),
      firstName: field(formData, "firstName"),
      lastName: field(formData, "lastName"),
      birthDate: optional(formData, "birthDate"),
      allergiesNote: optional(formData, "allergiesNote"),
      status: field(formData, "status"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from("students")
      .update({
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        birth_date: parsed.data.birthDate,
        allergies_note: parsed.data.allergiesNote,
        status: parsed.data.status,
      })
      .eq("id", parsed.data.studentId)
      .eq("school_id", schoolId)
      .select("id");
    if (error || !updated?.length) return { status: "error", message: t("saveError") };

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "student.update",
      entity: "students",
      entityId: parsed.data.studentId,
      diff: { status: parsed.data.status },
    });
    revalidatePath("/admin", "layout");
    return { status: "success", message: t("saved") };
  } catch (error) {
    return toActionError(error);
  }
}

/** Moves the student to `classId` for the current year (previous enrollment closed today). */
export async function enroll(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  studentId: string,
  classId: string,
): Promise<boolean> {
  const { data: cls } = await supabase
    .from("classes")
    .select("id, school_year_id, archived")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!cls || cls.archived) return false;

  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("enrollments")
    .update({ left_on: today })
    .eq("student_id", studentId)
    .eq("school_year_id", cls.school_year_id)
    .neq("class_id", classId)
    .is("left_on", null);

  const { error } = await supabase.from("enrollments").upsert(
    {
      student_id: studentId,
      class_id: classId,
      school_year_id: cls.school_year_id,
      joined_on: today,
      left_on: null,
    },
    { onConflict: "student_id,class_id" },
  );
  return !error;
}

export async function enrollStudent(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin", "staff"]);
  const studentId = field(formData, "studentId");
  const classId = field(formData, "classId");
  if (!uuid.test(studentId) || !uuid.test(classId)) return;
  const supabase = await createClient();
  const ok = await enroll(supabase, schoolId, studentId, classId);
  if (!ok) throw new Error("enrollment failed");
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "student.enroll",
    entity: "enrollments",
    entityId: studentId,
    diff: { classId },
  });
  revalidatePath("/admin", "layout");
}

const guardianSchema = z.object({
  studentId: z.string().regex(uuid),
  email: z.email().max(254),
  firstName: z.string().trim().max(80),
  lastName: z.string().trim().max(80),
  relation: z.enum(RELATIONS),
  isPrimary: z.boolean(),
  locale: z.enum(["fr", "en"]),
});

/** Links a guardian (existing account or a new invited one) to a student. */
export async function linkGuardian(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.students");
    const { user, schoolId } = await assertSchoolContext(["school_admin"]);
    const parsed = guardianSchema.safeParse({
      studentId: field(formData, "studentId"),
      email: field(formData, "email").toLowerCase(),
      firstName: field(formData, "firstName"),
      lastName: field(formData, "lastName"),
      relation: field(formData, "relation"),
      isPrimary: formData.get("isPrimary") === "on",
      locale: field(formData, "locale") || "fr",
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };

    const supabase = await createClient();
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("id", parsed.data.studentId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!student) return { status: "error", message: t("invalid") };

    const admin = createAdminClient();
    const account = await ensureAccount(admin, {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      locale: parsed.data.locale,
    });
    await ensureMembership(supabase, schoolId, account.userId, "parent");

    const { error } = await supabase.from("student_guardians").upsert(
      {
        student_id: parsed.data.studentId,
        user_id: account.userId,
        relation: parsed.data.relation,
        is_primary: parsed.data.isPrimary,
      },
      { onConflict: "student_id,user_id" },
    );
    if (error) return { status: "error", message: t("saveError") };

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "student.link_guardian",
      entity: "student_guardians",
      entityId: parsed.data.studentId,
      diff: { userId: account.userId, created: account.created },
    });
    revalidatePath("/admin", "layout");
    return {
      status: "success",
      message: account.created ? t("guardianInvited") : t("guardianLinked"),
    };
  } catch (error) {
    return toActionError(error);
  }
}

const flagsSchema = z.object({
  studentId: z.string().regex(uuid),
  userId: z.string().regex(uuid),
  canViewGrades: z.boolean(),
  canMessage: z.boolean(),
  receivesNotifications: z.boolean(),
  accessBlocked: z.boolean(),
  accessBlockedReason: z.string().trim().max(500).nullable(),
});

/** Independent rights per guardian, incl. the court restriction flag (audited). */
export async function updateGuardianFlags(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const t = await getTranslations("admin.students");
    const { user, schoolId } = await assertSchoolContext(["school_admin"]);
    const parsed = flagsSchema.safeParse({
      studentId: field(formData, "studentId"),
      userId: field(formData, "userId"),
      canViewGrades: formData.get("canViewGrades") === "on",
      canMessage: formData.get("canMessage") === "on",
      receivesNotifications: formData.get("receivesNotifications") === "on",
      accessBlocked: formData.get("accessBlocked") === "on",
      accessBlockedReason: optional(formData, "accessBlockedReason"),
    });
    if (!parsed.success) return { status: "error", message: t("invalid") };
    if (parsed.data.accessBlocked && !parsed.data.accessBlockedReason) {
      return { status: "error", message: t("blockReasonRequired") };
    }

    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from("student_guardians")
      .update({
        can_view_grades: parsed.data.canViewGrades,
        can_message: parsed.data.canMessage,
        receives_notifications: parsed.data.receivesNotifications,
        access_blocked: parsed.data.accessBlocked,
      })
      .eq("student_id", parsed.data.studentId)
      .eq("user_id", parsed.data.userId)
      .select("student_id");
    if (error || !updated?.length) return { status: "error", message: t("saveError") };

    // the reason of a court restriction is stored apart, readable by the direction only
    const restriction = parsed.data.accessBlocked
      ? await supabase.from("guardian_restrictions").upsert(
          {
            student_id: parsed.data.studentId,
            user_id: parsed.data.userId,
            reason: parsed.data.accessBlockedReason ?? "",
            decided_by: user.id,
          },
          { onConflict: "student_id,user_id" },
        )
      : await supabase
          .from("guardian_restrictions")
          .delete()
          .eq("student_id", parsed.data.studentId)
          .eq("user_id", parsed.data.userId);
    if (restriction.error) return { status: "error", message: t("saveError") };

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: parsed.data.accessBlocked ? "student_guardian.block" : "student_guardian.update",
      entity: "student_guardians",
      entityId: parsed.data.studentId,
      diff: {
        userId: parsed.data.userId,
        canViewGrades: parsed.data.canViewGrades,
        canMessage: parsed.data.canMessage,
        receivesNotifications: parsed.data.receivesNotifications,
        accessBlocked: parsed.data.accessBlocked,
        accessBlockedReason: parsed.data.accessBlockedReason,
      },
    });
    revalidatePath("/admin", "layout");
    return { status: "success", message: t("saved") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function unlinkGuardian(formData: FormData): Promise<void> {
  const { user, schoolId } = await assertSchoolContext(["school_admin"]);
  const studentId = field(formData, "studentId");
  const userId = field(formData, "userId");
  if (!uuid.test(studentId) || !uuid.test(userId)) return;
  const supabase = await createClient();
  const { data: removed, error } = await supabase
    .from("student_guardians")
    .delete()
    .eq("student_id", studentId)
    .eq("user_id", userId)
    .select("student_id");
  if (error) throw new Error(error.message);
  if (!removed?.length) return;
  await logAudit(supabase, {
    schoolId,
    actorId: user.id,
    action: "student.unlink_guardian",
    entity: "student_guardians",
    entityId: studentId,
    diff: { userId },
  });
  revalidatePath("/admin", "layout");
}
