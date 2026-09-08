"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { assertSchoolContext } from "@/lib/auth/guards";
import { type ImportIssue, type ImportRow, parseFamiliesCsv } from "@/lib/import/families";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";
import { ensureAccount, ensureMembership } from "@/server/actions/admin/accounts";
import { enroll } from "@/server/actions/admin/students";

import { type ActionState, field, toActionError } from "./_shared";

const MAX_SIZE = 2 * 1024 * 1024;

export type ImportPreviewState = ActionState & {
  csvText?: string;
  rowCount?: number;
  issues?: ImportIssue[];
  unknownClasses?: string[];
  classNames?: string[];
  emails?: number;
};

export type ImportCommitState = ActionState & {
  counts?: {
    studentsCreated: number;
    studentsExisting: number;
    accountsCreated: number;
    accountsExisting: number;
    membershipsCreated: number;
    guardiansLinked: number;
  };
  errors?: string[];
};

async function readCsv(formData: FormData): Promise<string | null> {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_SIZE) return null;
    return await file.text();
  }
  const text = field(formData, "csvText");
  return text || null;
}

async function currentYearClasses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
) {
  const { data } = await supabase
    .from("classes")
    .select("id, name, school_year:school_years!inner(id, is_current)")
    .eq("school_id", schoolId)
    .eq("archived", false)
    .eq("school_year.is_current", true);
  return new Map((data ?? []).map((c) => [c.name.trim().toLowerCase(), c.id]));
}

/** Step 1: parse, validate, and check class names against the current school year. */
export async function previewImport(
  _prev: ImportPreviewState,
  formData: FormData,
): Promise<ImportPreviewState> {
  try {
    const t = await getTranslations("admin.import");
    const { schoolId } = await assertSchoolContext(["school_admin"]);
    const csvText = await readCsv(formData);
    if (!csvText) return { status: "error", message: t("fileRequired") };

    const preview = parseFamiliesCsv(csvText);
    const supabase = await createClient();
    const classes = await currentYearClasses(supabase, schoolId);
    const unknownClasses = preview.classNames.filter(
      (name) => !classes.has(name.trim().toLowerCase()),
    );

    return {
      status: preview.issues.length || unknownClasses.length ? "error" : "success",
      message:
        preview.issues.length || unknownClasses.length
          ? t("previewProblems")
          : t("previewReady", { count: preview.rows.length }),
      csvText,
      rowCount: preview.rows.length,
      issues: preview.issues.slice(0, 200),
      unknownClasses,
      classNames: preview.classNames,
      emails: preview.emails.length,
    };
  } catch (error) {
    return toActionError(error);
  }
}

/** Step 2: create families, students, enrollments, accounts (no e-mail yet) and guardian links. */
export async function commitImport(
  _prev: ImportCommitState,
  formData: FormData,
): Promise<ImportCommitState> {
  try {
    const t = await getTranslations("admin.import");
    const { user, schoolId } = await assertSchoolContext(["school_admin"]);
    const csvText = await readCsv(formData);
    if (!csvText) return { status: "error", message: t("fileRequired") };

    const preview = parseFamiliesCsv(csvText);
    if (preview.issues.length > 0) return { status: "error", message: t("previewProblems") };

    const supabase = await createClient();
    const admin = createAdminClient();
    const classes = await currentYearClasses(supabase, schoolId);
    const unknown = preview.classNames.filter((name) => !classes.has(name.trim().toLowerCase()));
    if (unknown.length > 0)
      return { status: "error", message: t("unknownClasses", { classes: unknown.join(", ") }) };

    const { data: familyRows } = await supabase
      .from("families")
      .select("id, name")
      .eq("school_id", schoolId);
    const families = new Map((familyRows ?? []).map((f) => [f.name.trim().toLowerCase(), f.id]));
    const { data: studentRows } = await supabase
      .from("students")
      .select("id, first_name, last_name, birth_date")
      .eq("school_id", schoolId);
    const students = new Map(
      (studentRows ?? []).map((s) => [studentKey(s.first_name, s.last_name, s.birth_date), s.id]),
    );
    const accounts = new Map<string, string>();

    const counts = {
      studentsCreated: 0,
      studentsExisting: 0,
      accountsCreated: 0,
      accountsExisting: 0,
      membershipsCreated: 0,
      guardiansLinked: 0,
    };
    const errors: string[] = [];

    for (const row of preview.rows) {
      try {
        await importRow(row);
      } catch (error) {
        errors.push(
          `Ligne ${row.line} : ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    await logAudit(supabase, {
      schoolId,
      actorId: user.id,
      action: "import.families",
      entity: "students",
      diff: { ...counts, errors: errors.length },
    });
    revalidatePath("/admin", "layout");
    return {
      status: errors.length ? "error" : "success",
      message: errors.length ? t("commitPartial", { count: errors.length }) : t("commitDone"),
      counts,
      errors: errors.slice(0, 50),
    };

    async function importRow(row: ImportRow) {
      const familyKey = row.familyName.trim().toLowerCase();
      let familyId = families.get(familyKey);
      if (!familyId) {
        const { data, error } = await supabase
          .from("families")
          .insert({ school_id: schoolId, name: row.familyName })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        familyId = data.id;
        families.set(familyKey, familyId);
      }

      const key = studentKey(row.student.firstName, row.student.lastName, row.student.birthDate);
      let studentId = students.get(key);
      if (studentId) {
        counts.studentsExisting++;
      } else {
        const { data, error } = await supabase
          .from("students")
          .insert({
            school_id: schoolId,
            family_id: familyId,
            first_name: row.student.firstName,
            last_name: row.student.lastName,
            birth_date: row.student.birthDate,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        studentId = data.id;
        students.set(key, studentId);
        counts.studentsCreated++;
      }

      const classId = classes.get(row.className.trim().toLowerCase())!;
      const enrolled = await enroll(supabase, schoolId, studentId, classId);
      if (!enrolled) throw new Error(`inscription impossible dans ${row.className}`);

      for (const [index, guardian] of row.guardians.entries()) {
        let userId = accounts.get(guardian.email);
        if (!userId) {
          const account = await ensureAccount(admin, { ...guardian, locale: row.locale });
          userId = account.userId;
          accounts.set(guardian.email, userId);
          if (account.created) counts.accountsCreated++;
          else counts.accountsExisting++;
        }
        if (await ensureMembership(supabase, schoolId, userId, "parent"))
          counts.membershipsCreated++;
        if (guardian.phone) {
          await supabase
            .from("profiles")
            .update({ phone: guardian.phone })
            .eq("id", userId)
            .is("phone", null);
        }
        const { error } = await supabase.from("student_guardians").upsert(
          {
            student_id: studentId,
            user_id: userId,
            relation: guardian.relation,
            is_primary: index === 0,
          },
          { onConflict: "student_id,user_id", ignoreDuplicates: true },
        );
        if (error) throw new Error(error.message);
        counts.guardiansLinked++;
      }
    }
  } catch (error) {
    return toActionError(error);
  }
}

function studentKey(firstName: string, lastName: string, birthDate: string | null): string {
  return `${firstName.trim()}|${lastName.trim()}|${birthDate ?? ""}`.toLowerCase();
}
