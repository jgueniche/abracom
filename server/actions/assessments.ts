"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";
import { ASSESSMENT_LEVELS, type AssessmentLevel } from "@/lib/assessments";

import { type ActionState, field, toActionError, uuid } from "./admin/_shared";

export type SaveAssessmentsState = ActionState & { saved?: number; removed?: number };

function isLevel(value: string): value is AssessmentLevel {
  return (ASSESSMENT_LEVELS as readonly string[]).includes(value);
}

/**
 * Saves the whole matrix of a class for a period: cells `cell:<student>:<skill>` (level or empty),
 * optional `score:<student>:<skill>` (0–20, elementary classes with the scores module) and
 * `remark:<student>` texts. Published cells keep their publication; new ones wait for "Publier".
 */
export async function saveAssessments(
  _prev: SaveAssessmentsState,
  formData: FormData,
): Promise<SaveAssessmentsState> {
  try {
    const t = await getTranslations("assessments");
    const user = await requireCurrentUser();
    const classId = field(formData, "classId");
    const periodId = field(formData, "periodId");
    if (!uuid.test(classId) || !uuid.test(periodId))
      return { status: "error", message: t("invalid") };
    const scoresEnabled =
      (user.school?.modules as { assessments?: { scores?: boolean } } | null)?.assessments
        ?.scores === true;

    const supabase = await createClient();
    const { data: cls } = await supabase
      .from("classes")
      .select("id, school_id")
      .eq("id", classId)
      .maybeSingle();
    if (!cls) return { status: "error", message: t("invalid") };
    const { data: existing, error: loadError } = await supabase
      .from("assessments")
      .select("id, student_id, skill_id, comment, visible_to_parents, published_at")
      .eq("class_id", classId)
      .eq("period_id", periodId);
    if (loadError) return { status: "error", message: t("saveError") };
    const current = new Map(existing.map((row) => [`${row.student_id}:${row.skill_id}`, row]));

    const upserts: Array<{
      school_id: string;
      class_id: string;
      student_id: string;
      teacher_id: string;
      period_id: string;
      skill_id: string;
      level: AssessmentLevel | null;
      score: number | null;
      score_scale: "/20" | null;
      comment: string | null;
      visible_to_parents: boolean;
      published_at: string | null;
    }> = [];
    const removals: string[] = [];
    const remarks = new Map<string, string>();

    for (const [key, raw] of formData.entries()) {
      const value = String(raw).trim();
      if (key.startsWith("remark:")) {
        const studentId = key.slice("remark:".length);
        if (uuid.test(studentId)) remarks.set(studentId, value.slice(0, 2000));
        continue;
      }
      if (!key.startsWith("cell:")) continue;
      const [, studentId, skillId] = key.split(":");
      if (!studentId || !skillId || !uuid.test(studentId) || !uuid.test(skillId)) continue;
      const level = isLevel(value) ? value : null;
      const scoreRaw = scoresEnabled ? field(formData, `score:${studentId}:${skillId}`) : "";
      const score =
        scoreRaw !== "" && Number.isFinite(Number(scoreRaw))
          ? Math.min(20, Math.max(0, Math.round(Number(scoreRaw) * 100) / 100))
          : null;
      const previous = current.get(`${studentId}:${skillId}`);
      if (level === null && score === null) {
        if (previous) removals.push(previous.id);
        continue;
      }
      upserts.push({
        school_id: cls.school_id,
        class_id: classId,
        student_id: studentId,
        teacher_id: user.id,
        period_id: periodId,
        skill_id: skillId,
        level,
        score,
        score_scale: score === null ? null : "/20",
        comment: previous?.comment ?? null,
        visible_to_parents: previous?.visible_to_parents ?? false,
        published_at: previous?.published_at ?? null,
      });
    }

    if (upserts.length > 0) {
      const { error } = await supabase
        .from("assessments")
        .upsert(upserts, { onConflict: "student_id,skill_id,period_id" });
      if (error) return { status: "error", message: t("saveError") };
    }
    if (removals.length > 0) {
      const { error } = await supabase.from("assessments").delete().in("id", removals);
      if (error) return { status: "error", message: t("saveError") };
    }
    if (remarks.size > 0) {
      const bodies = [...remarks.entries()];
      const toDelete = bodies.filter(([, body]) => body === "").map(([studentId]) => studentId);
      const toUpsert = bodies
        .filter(([, body]) => body !== "")
        .map(([studentId, body]) => ({
          school_id: cls.school_id,
          class_id: classId,
          student_id: studentId,
          period_id: periodId,
          teacher_id: user.id,
          body,
        }));
      if (toUpsert.length > 0) {
        const { error } = await supabase
          .from("assessment_remarks")
          .upsert(toUpsert, { onConflict: "student_id,period_id" });
        if (error) return { status: "error", message: t("saveError") };
      }
      if (toDelete.length > 0) {
        await supabase
          .from("assessment_remarks")
          .delete()
          .eq("period_id", periodId)
          .in("student_id", toDelete);
      }
    }
    revalidatePath(`/classes/${classId}/evaluations`);
    return {
      status: "success",
      message: t("saved", { count: upserts.length }),
      saved: upserts.length,
      removed: removals.length,
    };
  } catch (error) {
    return toActionError(error);
  }
}

/** Makes every entered assessment of the period visible to the families (SQL function, audited). */
export async function publishAssessments(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const classId = field(formData, "classId");
  const periodId = field(formData, "periodId");
  if (!uuid.test(classId) || !uuid.test(periodId)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_assessments", {
    class_: classId,
    period: periodId,
  });
  if (error) throw new Error(error.message);
  if (user.school) {
    await logAudit(supabase, {
      schoolId: user.school.id,
      actorId: user.id,
      action: "assessments.publish_request",
      entity: "classes",
      entityId: classId,
      diff: { periodId },
    });
  }
  revalidatePath(`/classes/${classId}/evaluations`);
  revalidatePath("/famille");
}
