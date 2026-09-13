import "server-only";

import { createClient } from "@/lib/supabase/server";

export type TodayItem = {
  key: string;
  kind: "ack" | "homework" | "note" | "signature" | "event" | "attendance";
  title: string;
  detail: string | null;
  href: string;
  urgent: boolean;
};

const isoDay = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(date);

/**
 * "Qu'est-ce que je dois savoir aujourd'hui ?" — the one question a parent opens
 * the app for on a weekday evening, answered in one block instead of three tabs.
 *
 * Only things that are actually due: homework for today or tomorrow, a note
 * nobody has opened, a circular still to sign, an event today. Everything that
 * merely exists stays below.
 */
export async function getTodayForParent(
  userId: string,
  timeZone = "Europe/Paris",
  /**
   * A read-only guardian may open a circular but not sign it: the database
   * refuses the signature (`can_write_in_school`) and the Documents screen says
   * so in words. Their home was nonetheless heading the day with three "À
   * signer" rows — asking a grandmother for something the next screen tells her
   * she cannot give.
   */
  canSign = true,
): Promise<TodayItem[]> {
  const supabase = await createClient();
  const now = new Date();
  const today = isoDay(now, timeZone);
  const tomorrow = isoDay(new Date(now.getTime() + 86_400_000), timeZone);

  const [children, homework, notes, documents, events] = await Promise.all([
    supabase
      .from("student_guardians")
      .select("student_id, student:students ( id, first_name )")
      .eq("user_id", userId),
    supabase
      .from("class_posts")
      .select("id, title, subject, due_on, class_id, class:classes ( id, name )")
      .eq("type", "homework")
      .is("deleted_at", null)
      .not("published_at", "is", null)
      .gte("due_on", today)
      .lte("due_on", tomorrow)
      .order("due_on"),
    supabase
      .from("individual_notes")
      .select(
        "id, kind, body_md, created_at, student_id, student:students ( id, first_name ), reads:individual_note_reads ( user_id )",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("documents")
      .select("id, title, requires_signature, signatures:document_signatures ( user_id )")
      .eq("requires_signature", true)
      .is("deleted_at", null)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(20),
    supabase
      .from("events")
      .select("id, title, starts_at, all_day, location")
      .is("deleted_at", null)
      .neq("kind", "holiday")
      .gte("starts_at", `${today}T00:00:00`)
      .lte("starts_at", `${today}T23:59:59`)
      .order("starts_at")
      .limit(3),
  ]);

  const mine = new Set((children.data ?? []).map((row) => row.student_id));
  const items: TodayItem[] = [];

  for (const row of homework.data ?? []) {
    items.push({
      key: `homework-${row.id}`,
      kind: "homework",
      title: row.title,
      detail: [row.class?.name, row.subject].filter(Boolean).join(" · ") || null,
      href: "/devoirs",
      urgent: row.due_on === today,
    });
  }
  for (const row of notes.data ?? []) {
    if (!mine.has(row.student_id)) continue;
    if ((row.reads ?? []).some((read) => read.user_id === userId)) continue;
    items.push({
      key: `note-${row.id}`,
      kind: "note",
      title: row.student?.first_name ?? "",
      detail: row.body_md.replace(/[#*_>`]/g, "").slice(0, 90),
      href: "/famille",
      urgent: row.kind === "concern",
    });
  }
  for (const row of canSign ? (documents.data ?? []) : []) {
    if ((row.signatures ?? []).some((signature) => signature.user_id === userId)) continue;
    items.push({
      key: `signature-${row.id}`,
      kind: "signature",
      title: row.title,
      detail: null,
      href: `/documents/${row.id}`,
      urgent: true,
    });
  }
  for (const row of events.data ?? []) {
    items.push({
      key: `event-${row.id}`,
      kind: "event",
      title: row.title,
      detail: row.location,
      href: `/agenda/${row.id}`,
      urgent: false,
    });
  }
  // What is due first is what the reader sees first.
  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent)).slice(0, 8);
}

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
      // Editing exists since ADR-0059: the draft reopens where it was left.
      href: `/classes/${row.class_id}/publier?post=${row.id}`,
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
