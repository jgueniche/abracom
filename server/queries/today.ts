import "server-only";

import { createClient } from "@/lib/supabase/server";

const isoDay = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(date);

export type TeacherQueueItem = {
  key: string;
  kind: "draft" | "absence" | "assessment";
  title: string;
  detail: string | null;
  href: string;
  urgent: boolean;
};

export type ClassEventItem = {
  key: string;
  kind: "post" | "absence" | "appointment";
  title: string;
  detail: string | null;
  href: string;
  at: string;
};

/**
 * The two questions a teacher opens the application with — and neither had an
 * answer until now.
 *
 * The parent's home has had its "Aujourd'hui" block since session 19 and the
 * direction its queue since session 16; the teacher's home was a greeting, the
 * day's register and a grid of her own classes. Session 24 recorded the gap and
 * left it, because closing it needs queries rather than a change of layout.
 *
 * `queue` is only what is owed *by her*: a publication left as a draft, an
 * absence still to be ruled on, a competency entered and never published.
 * Nothing that merely exists, and nothing already carried by a tab badge —
 * unread messages are counted in the bar at the bottom of every screen.
 */
export async function getTeacherQueue(
  userId: string,
  classIds: string[],
): Promise<TeacherQueueItem[]> {
  if (classIds.length === 0) return [];
  const supabase = await createClient();

  const [drafts, enrolments, assessments, classes] = await Promise.all([
    supabase
      .from("class_posts")
      .select("id, title, type, class_id, updated_at")
      .in("class_id", classIds)
      .eq("author_id", userId)
      .is("deleted_at", null)
      .is("published_at", null)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("enrollments")
      .select("student_id, class_id")
      .in("class_id", classIds)
      .is("left_on", null),
    supabase
      .from("assessments")
      .select("id, class_id")
      .in("class_id", classIds)
      .is("published_at", null),
    supabase.from("classes").select("id, name").in("id", classIds),
  ]);

  const classNames = new Map((classes.data ?? []).map((row) => [row.id, row.name]));
  const classOf = new Map((enrolments.data ?? []).map((row) => [row.student_id, row.class_id]));
  const studentIds = [...classOf.keys()];

  const { data: absences } = studentIds.length
    ? await supabase
        .from("absences")
        .select("id, student_id, starts_on, justifications:absence_justifications ( id )")
        .in("student_id", studentIds)
        .eq("status", "declared")
        .order("starts_on", { ascending: false })
        .limit(200)
    : { data: [] };

  const items: TeacherQueueItem[] = [];

  for (const row of drafts.data ?? []) {
    items.push({
      key: `draft-${row.id}`,
      kind: "draft",
      title: row.title,
      detail: classNames.get(row.class_id) ?? null,
      // Editing exists since ADR-0059: the draft reopens where it was left — a homework in the
      // homework composer, an entry of the cahier de vie in the class's.
      href:
        row.type === "homework"
          ? `/devoirs/${row.id}/modifier`
          : `/classes/${row.class_id}/publier?post=${row.id}`,
      urgent: false,
    });
  }

  // One row per class rather than per pupil: the screen that rules on them is
  // the class register, and a teacher goes there once.
  const byClass = new Map<string, { count: number; signed: number }>();
  for (const row of absences ?? []) {
    const classId = classOf.get(row.student_id);
    if (!classId) continue;
    const bucket = byClass.get(classId) ?? { count: 0, signed: 0 };
    bucket.count += 1;
    if ((row.justifications ?? []).length > 0) bucket.signed += 1;
    byClass.set(classId, bucket);
  }
  for (const [classId, bucket] of byClass) {
    items.push({
      key: `absence-${classId}`,
      kind: "absence",
      title: classNames.get(classId) ?? "",
      detail: String(bucket.count),
      href: `/classes/${classId}/absences`,
      // A family has signed a note and is waiting for an answer.
      urgent: bucket.signed > 0,
    });
  }

  const pending = new Map<string, number>();
  for (const row of assessments.data ?? [])
    pending.set(row.class_id, (pending.get(row.class_id) ?? 0) + 1);
  for (const [classId, count] of pending) {
    items.push({
      key: `assessment-${classId}`,
      kind: "assessment",
      title: classNames.get(classId) ?? "",
      detail: String(count),
      href: `/classes/${classId}/evaluations`,
      urgent: false,
    });
  }

  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent)).slice(0, 8);
}

/** What has happened in the classes a teacher follows, over the last week. */
export async function getClassActivity(
  userId: string,
  classIds: string[],
  timeZone = "Europe/Paris",
): Promise<ClassEventItem[]> {
  if (classIds.length === 0) return [];
  const supabase = await createClient();
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const today = isoDay(now, timeZone);

  const [posts, enrolments, classes, slots] = await Promise.all([
    supabase
      .from("class_posts")
      .select(
        "id, title, type, class_id, published_at, author:profiles!class_posts_author_profile_fkey ( first_name, last_name )",
      )
      .in("class_id", classIds)
      .is("deleted_at", null)
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(10),
    supabase
      .from("enrollments")
      .select("student_id, class_id, student:students ( first_name, last_name )")
      .in("class_id", classIds)
      .is("left_on", null),
    supabase.from("classes").select("id, name").in("id", classIds),
    supabase
      .from("appointment_slots")
      .select("id, class_id, starts_at, student:students ( first_name, last_name )")
      .eq("teacher_id", userId)
      .not("booked_at", "is", null)
      .gte("starts_at", now.toISOString())
      .order("starts_at")
      .limit(5),
  ]);

  const classNames = new Map((classes.data ?? []).map((row) => [row.id, row.name]));
  const pupils = new Map(
    (enrolments.data ?? []).map((row) => [
      row.student_id,
      {
        classId: row.class_id,
        name: row.student ? `${row.student.first_name} ${row.student.last_name}` : "",
      },
    ]),
  );

  const { data: absences } = pupils.size
    ? await supabase
        .from("absences")
        .select("id, student_id, starts_on, created_at, kind")
        .in("student_id", [...pupils.keys()])
        .lte("starts_on", today)
        .gte("ends_on", today)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  const items: ClassEventItem[] = [];
  for (const row of posts.data ?? [])
    items.push({
      key: `post-${row.id}`,
      kind: "post",
      title: row.title,
      detail: [
        classNames.get(row.class_id),
        row.author ? `${row.author.first_name} ${row.author.last_name}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/classes/${row.class_id}/${row.type === "homework" ? "devoirs" : "cahier"}`,
      at: row.published_at!,
    });
  for (const row of absences ?? []) {
    const pupil = pupils.get(row.student_id);
    if (!pupil) continue;
    items.push({
      key: `absence-${row.id}`,
      kind: "absence",
      title: pupil.name,
      detail: classNames.get(pupil.classId) ?? null,
      href: `/classes/${pupil.classId}/absences`,
      at: row.created_at,
    });
  }
  for (const row of slots.data ?? [])
    items.push({
      key: `slot-${row.id}`,
      kind: "appointment",
      title: row.student ? `${row.student.first_name} ${row.student.last_name}` : "",
      detail: classNames.get(row.class_id) ?? null,
      href: `/classes/${row.class_id}/rdv`,
      at: row.starts_at,
    });

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}
