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
  for (const row of documents.data ?? []) {
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
