import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import { addDays, localDateKey } from "@/lib/calendar/dates";
import { pivotDay, SCHOOL_TIME_ZONE } from "@/lib/homework";
import { createClient } from "@/lib/supabase/server";

import { getPendingAcknowledgements } from "./announcements";
import type { ChildWithClass } from "./family";

/**
 * The parent's home answers three questions, in this order (ADR-0081):
 *
 *  1. **À faire** — what the school is waiting for *from me*: a circular to read and
 *     acknowledge, a document to sign. Each with its verb and, when the school gave
 *     one, the day it is due.
 *  2. **Pour demain** — one line per child for the day being prepared, not the list of
 *     homework itself (the Devoirs tab is that list).
 *  3. **Nouveau** — what arrived without asking anything: a note about a child, a page
 *     of the class journal.
 *
 * It used to be a single « Aujourd'hui » list where a signature owed and a poem for
 * Monday had the same weight, under a title that was false for both.
 */

const initialsOf = (first?: string | null, last?: string | null) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "·";

export type HomeAction = {
  key: string;
  kind: "ack" | "signature";
  title: string;
  href: string;
  /** `YYYY-MM-DD`, when the school set one (ADR-0082). */
  dueOn: string | null;
  context: string | null;
};

export type ChildDay = {
  studentId: string;
  firstName: string;
  initials: string;
  className: string | null;
  /** The homework of the day being prepared. */
  total: number;
  done: number;
  titles: string[];
  /** When there is none that day: the next one, to say « rien pour demain » usefully. */
  next: { title: string; dueOn: string } | null;
};

export type HomeNews = {
  key: string;
  kind: "note" | "journal";
  title: string;
  detail: string | null;
  href: string;
  at: string;
  initials: string;
};

/**
 * The due dates of announcements or documents, by id.
 *
 * Read on their own and forgiving: the column arrives with a migration
 * (20261101100000_due_dates) that the deploy workflow applies on merge, and a
 * preview built from this branch may run against a database that has not got it
 * yet. Without the column the home simply shows no date.
 */
export async function getDueDates(table: "announcements" | "documents", ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).select("id, due_on").in("id", ids);
  if (error || !data) return new Map<string, string>();
  return new Map(
    (data as Array<{ id: string; due_on: string | null }>)
      .filter((row) => row.due_on)
      .map((row) => [row.id, row.due_on!] as const),
  );
}

export async function getParentActions(userId: string, canSign: boolean): Promise<HomeAction[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const [pending, documents] = await Promise.all([
    getPendingAcknowledgements(userId),
    canSign
      ? supabase
          .from("documents")
          .select(
            "id, title, school_id, signature_per_student, signatures:document_signatures ( user_id )",
          )
          .eq("requires_signature", true)
          .is("deleted_at", null)
          .not("published_at", "is", null)
          .order("published_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const toSign = (documents.data ?? []).filter(
    (row) =>
      row.school_id === user?.school?.id &&
      !(row.signatures ?? []).some((signature) => signature.user_id === userId),
  );

  const [ackDue, signDue] = await Promise.all([
    getDueDates(
      "announcements",
      pending.map((row) => row.id),
    ),
    getDueDates(
      "documents",
      toSign.map((row) => row.id),
    ),
  ]);

  const actions: HomeAction[] = [
    ...toSign.map((row) => ({
      key: `signature-${row.id}`,
      kind: "signature" as const,
      title: row.title,
      href: `/documents/${row.id}`,
      dueOn: signDue.get(row.id) ?? null,
      context: null,
    })),
    ...pending.map((row) => ({
      key: `ack-${row.id}`,
      kind: "ack" as const,
      title: row.title,
      href: `/annonces/${row.id}`,
      dueOn: ackDue.get(row.id) ?? null,
      context: null,
    })),
  ];
  // What is due first comes first; what has no date keeps its place after the dated ones.
  return actions.sort((a, b) => {
    if (a.dueOn && b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    if (a.dueOn) return -1;
    if (b.dueOn) return 1;
    return 0;
  });
}

/**
 * One line per child for the day being prepared (`pivotDay`: today until noon, then the next
 * school day), and, for a child with nothing that day, the next homework within a fortnight.
 * Two queries for all the children together, whatever their number.
 */
export async function getChildrenDay(
  children: ChildWithClass[],
  now = new Date(),
): Promise<{ pivot: string; days: ChildDay[] }> {
  const pivot = pivotDay(now, SCHOOL_TIME_ZONE);
  const classOf = new Map(
    children.map((row) => [row.student.id, row.student.enrollments[0]?.class ?? null] as const),
  );
  const classIds = [...new Set([...classOf.values()].filter(Boolean).map((klass) => klass!.id))];
  if (classIds.length === 0) {
    return {
      pivot,
      days: children.map((row) => ({
        studentId: row.student.id,
        firstName: row.student.first_name,
        initials: initialsOf(row.student.first_name, row.student.last_name),
        className: null,
        total: 0,
        done: 0,
        titles: [],
        next: null,
      })),
    };
  }

  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("class_posts")
    .select("id, title, class_id, due_on, completions:homework_completions ( student_id )")
    .in("class_id", classIds)
    .eq("type", "homework")
    .is("deleted_at", null)
    .not("published_at", "is", null)
    .gte("due_on", pivot)
    .lte("due_on", addDays(pivot, 14))
    .order("due_on")
    .order("subject", { nullsFirst: false })
    .order("created_at");

  const days = children.map((row): ChildDay => {
    const klass = classOf.get(row.student.id) ?? null;
    const mine = (posts ?? []).filter((post) => post.class_id === klass?.id);
    const ofPivot = mine.filter((post) => post.due_on === pivot);
    const later = mine.find((post) => post.due_on !== null && post.due_on > pivot);
    return {
      studentId: row.student.id,
      firstName: row.student.first_name,
      initials: initialsOf(row.student.first_name, row.student.last_name),
      className: klass?.name ?? null,
      total: ofPivot.length,
      done: ofPivot.filter((post) =>
        (post.completions ?? []).some((done) => done.student_id === row.student.id),
      ).length,
      titles: ofPivot.map((post) => post.title),
      next:
        ofPivot.length === 0 && later?.due_on ? { title: later.title, dueOn: later.due_on } : null,
    };
  });
  return { pivot, days };
}

/**
 * What arrived without asking anything of the reader: a note about one of their children not
 * yet opened, and the class journal of the last seven days (one entry per class at most, the
 * latest: the journal itself is one tap away).
 */
export async function getParentNews(
  userId: string,
  children: ChildWithClass[],
  now = new Date(),
): Promise<HomeNews[]> {
  const studentIds = children.map((row) => row.student.id);
  const classOf = new Map(
    children.map((row) => [row.student.id, row.student.enrollments[0]?.class?.id ?? null]),
  );
  const classIds = [...new Set([...classOf.values()].filter(Boolean) as string[])];
  if (studentIds.length === 0) return [];
  const supabase = await createClient();
  const since = `${addDays(localDateKey(now, SCHOOL_TIME_ZONE), -7)}T00:00:00`;

  const [notes, journal] = await Promise.all([
    supabase
      .from("individual_notes")
      .select(
        "id, body_md, created_at, student_id, student:students ( first_name ), author:profiles ( first_name, last_name ), reads:individual_note_reads ( user_id )",
      )
      .in("student_id", studentIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    classIds.length
      ? supabase
          .from("class_posts")
          .select(
            "id, title, class_id, published_at, class:classes ( name ), author:profiles!class_posts_author_profile_fkey ( first_name, last_name )",
          )
          .in("class_id", classIds)
          .neq("type", "homework")
          .is("deleted_at", null)
          .not("published_at", "is", null)
          .gte("published_at", since)
          .order("published_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const news: HomeNews[] = [];
  for (const row of notes.data ?? []) {
    if ((row.reads ?? []).some((read) => read.user_id === userId)) continue;
    news.push({
      key: `note-${row.id}`,
      kind: "note",
      title: row.student?.first_name ?? "",
      detail: row.body_md.replace(/[#*_>`]/g, "").slice(0, 120),
      // a note is read in the child's class, under « Mots »
      href: classOf.get(row.student_id)
        ? `/classes/${classOf.get(row.student_id)}/mots`
        : "/classes",
      at: row.created_at,
      initials: initialsOf(row.author?.first_name, row.author?.last_name),
    });
  }
  const seen = new Set<string>();
  for (const row of journal.data ?? []) {
    if (seen.has(row.class_id)) continue;
    seen.add(row.class_id);
    news.push({
      key: `journal-${row.id}`,
      kind: "journal",
      title: row.class?.name ?? "",
      detail: row.title,
      href: `/classes/${row.class_id}/cahier`,
      at: row.published_at!,
      initials: initialsOf(row.author?.first_name, row.author?.last_name),
    });
  }
  return news.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
}
