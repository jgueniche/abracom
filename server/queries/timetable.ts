import "server-only";

import { createClient } from "@/lib/supabase/server";

/** The week of a class, ordered as it is read: day, then hour. */
export async function getClassWeek(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("class_week", { class_: classId });
  if (error) throw error;
  return data ?? [];
}

export type TimetableSlot = Awaited<ReturnType<typeof getClassWeek>>[number];

/** Late arrivals over a period, both registers added up. */
export async function getLateReport(schoolId: string, from: string, to: string, classId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("late_report", {
    school_: schoolId,
    from_: from,
    to_: to,
    class_: classId ?? undefined,
  });
  if (error) throw error;
  return data ?? [];
}

export type LateRow = Awaited<ReturnType<typeof getLateReport>>[number];

/** The signed excuse notes of a set of absences, keyed by absence. */
export async function getAbsenceJustifications(absenceIds: string[]) {
  const grouped = new Map<
    string,
    { statement: string; signedName: string; signedAt: string; by: string | null }
  >();
  if (absenceIds.length === 0) return grouped;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("absence_justifications")
    .select(
      "absence_id, statement, signed_name, signed_at, profile:profiles!absence_justifications_user_profile_fkey ( first_name, last_name )",
    )
    .in("absence_id", absenceIds);
  if (error) throw error;
  for (const row of data ?? []) {
    grouped.set(row.absence_id, {
      statement: row.statement,
      signedName: row.signed_name,
      signedAt: row.signed_at,
      by: row.profile ? `${row.profile.first_name} ${row.profile.last_name}` : null,
    });
  }
  return grouped;
}
