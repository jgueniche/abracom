import "server-only";

import { createClient } from "@/lib/supabase/server";

export { ASSESSMENT_LEVELS, type AssessmentLevel } from "@/lib/assessments";

/** Periods of the current school year, in order. */
export async function getAssessmentPeriods(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessment_periods")
    .select(
      "id, label, starts_on, ends_on, sort_order, school_year:school_years!inner ( is_current )",
    )
    .eq("school_id", schoolId)
    .eq("school_year.is_current", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export type AssessmentPeriod = Awaited<ReturnType<typeof getAssessmentPeriods>>[number];

/** The period containing `today`, else the last one already started, else the first. */
export function currentPeriod<T extends { starts_on: string; ends_on: string }>(
  periods: T[],
  today: string,
): T | null {
  return (
    periods.find((p) => p.starts_on <= today && today <= p.ends_on) ??
    [...periods].reverse().find((p) => p.starts_on <= today) ??
    periods[0] ??
    null
  );
}

export async function getSkillCatalogForClass(classId: string) {
  const supabase = await createClient();
  const { data: cls } = await supabase
    .from("classes")
    .select("id, school_id, level_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return { cls: null, skills: [] };
  const { data, error } = await supabase
    .from("skill_catalog")
    .select("id, domain, code, label_fr, label_en, sort_order")
    .eq("school_id", cls.school_id)
    .eq("level_id", cls.level_id)
    .order("sort_order");
  if (error) throw error;
  return { cls, skills: data ?? [] };
}

export type Skill = {
  id: string;
  domain: string;
  code: string;
  label_fr: string;
  label_en: string;
};

export function groupSkillsByDomain<T extends { domain: string }>(
  skills: T[],
): Array<{ domain: string; skills: T[] }> {
  const groups: Array<{ domain: string; skills: T[] }> = [];
  for (const skill of skills) {
    const group = groups.find((g) => g.domain === skill.domain);
    if (group) group.skills.push(skill);
    else groups.push({ domain: skill.domain, skills: [skill] });
  }
  return groups;
}

/** Every assessment of a class for a period visible to the caller (RLS). */
export async function getClassAssessments(classId: string, periodId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select(
      "id, student_id, skill_id, level, score, score_scale, comment, visible_to_parents, published_at, teacher_id",
    )
    .eq("class_id", classId)
    .eq("period_id", periodId);
  if (error) throw error;
  return data ?? [];
}

export async function getClassRemarks(classId: string, periodId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessment_remarks")
    .select("id, student_id, body, teacher_id, updated_at")
    .eq("class_id", classId)
    .eq("period_id", periodId);
  if (error) throw error;
  return data ?? [];
}

/** Everything the report card needs for one student, filtered by RLS for the caller. */
export async function getStudentReport(studentId: string) {
  const supabase = await createClient();
  const [student, assessments, remarks, absences] = await Promise.all([
    supabase
      .from("students")
      .select(
        `id, first_name, last_name, birth_date, school_id,
         school:schools ( name, city ),
         enrollments ( joined_on, left_on,
           class:classes ( id, name,
             level:levels ( id, code, label_fr, label_en ),
             class_teachers ( role, profile:profiles ( first_name, last_name ) ) ) )`,
      )
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("assessments")
      .select(
        `id, level, score, score_scale, comment, published_at, class_id,
         period:assessment_periods ( id, label, starts_on, ends_on, sort_order ),
         skill:skill_catalog ( id, domain, code, label_fr, label_en, sort_order )`,
      )
      .eq("student_id", studentId),
    supabase
      .from("assessment_remarks")
      .select("period_id, body, updated_at")
      .eq("student_id", studentId),
    supabase
      .from("absences")
      .select("kind, status, starts_on, ends_on")
      .eq("student_id", studentId),
  ]);
  if (student.error) throw student.error;
  if (!student.data) return null;
  const today = new Date().toISOString().slice(0, 10);
  const enrollment =
    student.data.enrollments.find((e) => e.left_on === null || e.left_on >= today) ??
    student.data.enrollments[0] ??
    null;
  return {
    student: student.data,
    enrollment,
    assessments: (assessments.data ?? []).filter((a) => a.period && a.skill),
    remarks: remarks.data ?? [],
    absences: absences.data ?? [],
  };
}

export type StudentReport = NonNullable<Awaited<ReturnType<typeof getStudentReport>>>;
