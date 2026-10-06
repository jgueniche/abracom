import "server-only";

import { createClient } from "@/lib/supabase/server";

const POST_SELECT = `
  id, class_id, school_id, type, title, body_md, subject, due_on, published_at, visibility, created_at, updated_at, author_id,
  author:profiles!class_posts_author_profile_fkey ( id, first_name, last_name ),
  media:class_post_media ( id, storage_path, thumb_path, kind, width, height, blurhash, caption, filename, size_bytes, tagged_student_ids, sort_order ),
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

export type ClassPostType = "homework" | "journal" | "info" | "reminder";

/**
 * The three kinds of entry a cahier de vie holds. `info` and `reminder` were
 * written by the composer since session 5 and read by no screen at all: the
 * only two calls to this query asked for `journal` or for `homework`, so a
 * teacher who chose "Info" published into a table nobody queried. They are
 * categories of the diary, not destinations of their own (ADR-0059).
 */
export const JOURNAL_TYPES = ["journal", "info", "reminder"] as const;

/** Feed of a class (RLS decides drafts / staff-only visibility). */
export async function getClassFeed(
  classId: string,
  type?: ClassPostType | readonly ClassPostType[],
) {
  const supabase = await createClient();
  let request = supabase
    .from("class_posts")
    .select(POST_SELECT)
    .eq("class_id", classId)
    .is("deleted_at", null)
    .order("published_at", { ascending: false, nullsFirst: true })
    .limit(60);
  if (Array.isArray(type)) request = request.in("type", type as ClassPostType[]);
  else if (type) request = request.eq("type", type as ClassPostType);
  const { data, error } = await request;
  if (error) throw error;
  return data.map((post) => ({
    ...post,
    media: [...post.media].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export type ClassPost = Awaited<ReturnType<typeof getClassFeed>>[number];

/** One post, to re-open it in the composer (RLS decides who may read a draft). */
export async function getClassPost(classId: string, postId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .eq("class_id", classId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Homework due between two dates, across every class the reader follows.
 *
 * This is what makes a cahier de texte out of a per-class list: a parent with
 * two children in two classes reads one diary, not two tabs. Drafts come back to
 * the people allowed to read them — their author and the office (RLS) — and to
 * nobody else, so a teacher finds the homework she has not published yet on the
 * day it is set for, instead of in a list she has to go looking for.
 */
export async function getHomeworkDiary(classIds: string[], from: string, to: string) {
  if (classIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_posts")
    .select(`${POST_SELECT}, class:classes ( id, name )`)
    .in("class_id", classIds)
    .eq("type", "homework")
    .is("deleted_at", null)
    .gte("due_on", from)
    .lte("due_on", to)
    .order("due_on")
    .order("subject", { nullsFirst: false })
    .order("created_at");
  if (error) throw error;
  return data.map((post) => ({
    ...post,
    media: [...post.media].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

/** One homework, wherever it is read from — a notification, the home page, a shared link. */
export async function getHomework(postId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_posts")
    .select(`${POST_SELECT}, class:classes ( id, name, school_id )`)
    .eq("id", postId)
    .eq("type", "homework")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, media: [...data.media].sort((a, b) => a.sort_order - b.sort_order) };
}

/**
 * What the homework composer suggests: the class's weekly timetable (to place a homework on
 * "the next lesson") and the subjects already used for its homework.
 */
export async function getHomeworkComposerContext(classId: string) {
  const supabase = await createClient();
  const [{ data: week }, { data: recent }] = await Promise.all([
    supabase.rpc("class_week", { class_: classId }),
    supabase
      .from("class_posts")
      .select("subject")
      .eq("class_id", classId)
      .eq("type", "homework")
      .is("deleted_at", null)
      .not("subject", "is", null)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  return {
    slots: (week ?? []).map((slot) => ({ weekday: slot.weekday, subject: slot.subject })),
    usedSubjects: (recent ?? []).map((row) => row.subject),
  };
}

export type DiaryEntry = Awaited<ReturnType<typeof getHomeworkDiary>>[number];

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

/** Pupils currently enrolled in each class — the denominator of « Fait : 12 / 24 ». */
export async function getClassSizes(classIds: string[]): Promise<Map<string, number>> {
  const sizes = new Map<string, number>();
  if (classIds.length === 0) return sizes;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("class_id")
    .in("class_id", classIds)
    .is("left_on", null);
  if (error) throw error;
  for (const row of data ?? []) sizes.set(row.class_id, (sizes.get(row.class_id) ?? 0) + 1);
  return sizes;
}

/** Whether the reader teaches this class — the team side of a homework page. */
export async function isClassTeacher(classId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("class_teachers")
    .select("user_id", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}
