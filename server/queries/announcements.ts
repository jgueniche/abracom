import "server-only";

import { createClient } from "@/lib/supabase/server";

const LIST_SELECT = `
  id, title, title_en, body_md, body_md_en, locale, audience, target_ids, pinned, requires_ack,
  published_at, expires_at, created_at, updated_at, deleted_at, template, document_id, author_id,
  author:profiles!announcements_author_profile_fkey ( first_name, last_name ),
  attachments:announcement_attachments ( id, filename, size_bytes, mime, storage_path ),
  reads:announcement_reads ( user_id, read_at, acked_at )
` as const;

function withMyRead<
  T extends { reads: Array<{ user_id: string; read_at: string; acked_at: string | null }> },
>(row: T, userId: string) {
  const mine = row.reads.find((r) => r.user_id === userId) ?? null;
  return { ...row, myRead: mine, isRead: mine !== null, isAcked: mine?.acked_at != null };
}

/** Announcements visible to the signed-in user (RLS), pinned first, with their own read status. */
export async function getAnnouncementsForUser(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(LIST_SELECT)
    .is("deleted_at", null)
    .not("published_at", "is", null)
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data.map((row) => withMyRead(row, userId));
}

export async function getAnnouncement(userId: string, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(LIST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? withMyRead(data, userId) : null;
}

/** Published announcements that require an acknowledgement the user has not given yet. */
export async function getPendingAcknowledgements(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, published_at, reads:announcement_reads ( user_id, acked_at )")
    .eq("requires_ack", true)
    .is("deleted_at", null)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).filter(
    (a) => !a.reads.some((r) => r.user_id === userId && r.acked_at !== null),
  );
}

export type AnnouncementStatus = "draft" | "scheduled" | "published" | "expired";

export function announcementStatus(a: {
  published_at: string | null;
  expires_at: string | null;
}): AnnouncementStatus {
  if (!a.published_at) return "draft";
  const now = Date.now();
  if (new Date(a.published_at).getTime() > now) return "scheduled";
  if (a.expires_at && new Date(a.expires_at).getTime() <= now) return "expired";
  return "published";
}

/** Staff list, including drafts and scheduled ones. */
export async function getAdminAnnouncements(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(LIST_SELECT)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: true })
    .limit(200);
  if (error) throw error;
  return data.map((a) => ({ ...a, status: announcementStatus(a) }));
}

/** Recipients with read / ack timestamps (staff only, see announcement_recipients()). */
export async function getAnnouncementRecipients(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("announcement_recipients", { announcement: id });
  if (error) throw error;
  const rows = data ?? [];
  return {
    rows,
    total: rows.length,
    read: rows.filter((r) => r.read_at !== null).length,
    acked: rows.filter((r) => r.acked_at !== null).length,
  };
}

/** Audience targets available to the editor: levels, classes and members of the school. */
export async function getAudienceOptions(schoolId: string) {
  const supabase = await createClient();
  const [levels, classes, members, documents] = await Promise.all([
    supabase
      .from("levels")
      .select("id, code, label_fr, label_en")
      .eq("school_id", schoolId)
      .order("sort_order"),
    supabase
      .from("classes")
      .select("id, name, school_year:school_years!inner ( is_current )")
      .eq("school_id", schoolId)
      .eq("archived", false)
      .eq("school_year.is_current", true)
      .order("name"),
    supabase
      .from("memberships")
      .select("user_id, role, profile:profiles ( first_name, last_name )")
      .eq("school_id", schoolId)
      .eq("status", "active"),
    supabase
      .from("documents")
      .select("id, title")
      .eq("school_id", schoolId)
      .eq("requires_signature", true)
      .is("deleted_at", null)
      .order("title"),
  ]);
  const seen = new Set<string>();
  const users = (members.data ?? [])
    .filter((m) => m.profile && !seen.has(m.user_id) && seen.add(m.user_id))
    .map((m) => ({
      id: m.user_id,
      name: `${m.profile!.last_name} ${m.profile!.first_name}`,
      role: m.role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    levels: levels.data ?? [],
    classes: (classes.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    users,
    documents: documents.data ?? [],
  };
}
