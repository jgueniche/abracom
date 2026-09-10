import "server-only";

import { createClient } from "@/lib/supabase/server";

/** The lists the caller may point on a given day, with the state of that day. */
export async function getMyAttendanceLists(onDate?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_attendance_lists", {
    on_date_: onDate ?? undefined,
  });
  if (error) throw error;
  return data ?? [];
}

export type AttendanceListRow = Awaited<ReturnType<typeof getMyAttendanceLists>>[number];

export async function getAttendanceSession(sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select(
      `id, school_id, list_id, on_date, opened_at, closed_at, note,
       list:attendance_lists ( id, name, kind, records_pickup, visible_to_guardians, class_id,
                               class:classes ( id, name ) )`,
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** One row per expected child: what was pointed, and who may collect them. */
export async function getAttendanceRoster(sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_roster", { session_: sessionId });
  if (error) throw error;
  return data ?? [];
}

export type RosterRow = Awaited<ReturnType<typeof getAttendanceRoster>>[number];

/** The guardians each child may be handed over to, blocked ones excluded in SQL. */
export async function getPickupOptions(studentIds: string[]) {
  const supabase = await createClient();
  const entries = await Promise.all(
    studentIds.map(async (studentId) => {
      const { data } = await supabase.rpc("attendance_pickup_options", { student_: studentId });
      return [studentId, data ?? []] as const;
    }),
  );
  return new Map(entries);
}

export async function getAttendanceLists(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_lists")
    .select(
      `id, kind, name, code, class_id, class_ids, event_id, weekdays, starts_on, ends_on,
       records_pickup, visible_to_guardians, archived,
       class:classes ( id, name ),
       event:events ( id, title, starts_at ),
       managers:attendance_list_managers ( user_id, profile:profiles ( id, first_name, last_name ) )`,
    )
    .eq("school_id", schoolId)
    .eq("archived", false)
    .order("kind")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export type AdminAttendanceList = Awaited<ReturnType<typeof getAttendanceLists>>[number];

/** What a guardian may follow of their own child (after-school club and outings). */
export async function getChildAttendance(studentId: string, days = 14) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("child_attendance", {
    student_: studentId,
    days,
  });
  if (error) throw error;
  return data ?? [];
}

/** Does an event already carry its attendance list? */
export async function getEventAttendanceList(eventId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_lists")
    .select("id, name")
    .eq("event_id", eventId)
    .eq("archived", false)
    .maybeSingle();
  if (error) throw error;
  return data;
}
