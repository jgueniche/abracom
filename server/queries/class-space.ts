import "server-only";

import { createClient } from "@/lib/supabase/server";

const POST_SELECT = `
  id, class_id, school_id, type, title, body_md, subject, due_on, published_at, visibility, created_at, updated_at, author_id,
  author:profiles ( id, first_name, last_name ),
  media:class_post_media ( id, storage_path, kind, width, height, blurhash, caption, tagged_student_ids, sort_order ),
  completions:homework_completions ( student_id, done_at, marked_by_user_id )
` as const;

export async function getClassSummary(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select(
      `id, name, room, school_id,
       level:levels ( code, label_fr, label_en ),
       school_year:school_years ( label, is_current ),
       class_teachers ( role, subject, user_id, profile:profiles ( id, first_name, last_name ) ),
       enrollments ( id, left_on, student:students ( id, first_name, last_name, image_rights_signed_at ) )`,
    )
    .eq("id", classId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    students: data.enrollments
      .filter((e) => e.left_on === null && e.student)
      .map((e) => e.student!)
      .sort((a, b) => a.last_name.localeCompare(b.last_name)),
  };
}

/** Feed of a class (RLS decides drafts / staff-only visibility). */
export async function getClassFeed(
  classId: string,
  type?: "homework" | "journal" | "info" | "reminder",
) {
  const supabase = await createClient();
  let request = supabase
    .from("class_posts")
    .select(POST_SELECT)
    .eq("class_id", classId)
    .is("deleted_at", null)
    .order("published_at", { ascending: false, nullsFirst: true })
    .limit(60);
  if (type) request = request.eq("type", type);
  const { data, error } = await request;
  if (error) throw error;
  return data.map((post) => ({
    ...post,
    media: [...post.media].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export type ClassPost = Awaited<ReturnType<typeof getClassFeed>>[number];

/** Homework of the coming weeks (parent weekly view). */
export async function getUpcomingHomework(classIds: string[], from: string, to: string) {
  if (classIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_posts")
    .select(POST_SELECT)
    .in("class_id", classIds)
    .eq("type", "homework")
    .is("deleted_at", null)
    .gte("due_on", from)
    .lte("due_on", to)
    .order("due_on");
  if (error) throw error;
  return data;
}

export async function getIndividualNotes(studentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("individual_notes")
    .select(
      "id, body_md, visibility, kind, created_at, author:profiles ( first_name, last_name ), reads:individual_note_reads ( user_id, read_at )",
    )
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Notes of several pupils in one query, grouped by pupil (teacher and staff views). */
export async function getIndividualNotesForStudents(studentIds: string[]) {
  const grouped = new Map<string, Awaited<ReturnType<typeof getIndividualNotes>>>();
  if (studentIds.length === 0) return grouped;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("individual_notes")
    .select(
      "id, student_id, body_md, visibility, kind, created_at, author:profiles ( first_name, last_name ), reads:individual_note_reads ( user_id, read_at )",
    )
    .in("student_id", studentIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  for (const row of data) {
    const list = grouped.get(row.student_id) ?? [];
    list.push(row);
    grouped.set(row.student_id, list);
  }
  return grouped;
}

export async function getAbsences(studentIds: string[]) {
  if (studentIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("absences")
    .select(
      "id, student_id, kind, status, starts_on, ends_on, reason, justification_path, reviewed_at, created_at, student:students ( first_name, last_name )",
    )
    .in("student_id", studentIds)
    .order("starts_on", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function getClassAbsences(classId: string) {
  const supabase = await createClient();
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("class_id", classId)
    .is("left_on", null);
  return getAbsences((enrollments ?? []).map((e) => e.student_id));
}

/** The classes a user may open: children's classes (parent) and taught classes (teacher). */
export async function getMyClassIds(userId: string) {
  const supabase = await createClient();
  const [{ data: teaching }, { data: guardian }] = await Promise.all([
    supabase.from("class_teachers").select("class_id").eq("user_id", userId),
    supabase
      .from("student_guardians")
      .select("student:students ( enrollments ( class_id, left_on ) )")
      .eq("user_id", userId),
  ]);
  const ids = new Set<string>();
  for (const row of teaching ?? []) ids.add(row.class_id);
  for (const row of guardian ?? []) {
    for (const e of row.student?.enrollments ?? []) if (e.left_on === null) ids.add(e.class_id);
  }
  return [...ids];
}

/** Teacher weekly view: posts published in the last 7 days and homework due in the next 7 days, per class. */
export async function getWeeklySummary(classIds: string[]) {
  const summary = new Map<string, { posts: number; homework: number }>();
  if (classIds.length === 0) return summary;
  const supabase = await createClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const [{ data: recent }, { data: due }] = await Promise.all([
    supabase
      .from("class_posts")
      .select("class_id")
      .in("class_id", classIds)
      .is("deleted_at", null)
      .gte("published_at", weekAgo),
    supabase
      .from("class_posts")
      .select("class_id")
      .in("class_id", classIds)
      .eq("type", "homework")
      .is("deleted_at", null)
      .gte("due_on", today)
      .lte("due_on", weekAhead),
  ]);
  for (const id of classIds) summary.set(id, { posts: 0, homework: 0 });
  for (const row of recent ?? []) summary.get(row.class_id)!.posts++;
  for (const row of due ?? []) summary.get(row.class_id)!.homework++;
  return summary;
}
