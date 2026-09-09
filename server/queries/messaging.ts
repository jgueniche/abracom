import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getMyThreads() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_threads");
  if (error) throw error;
  return data ?? [];
}

export type ThreadSummary = Awaited<ReturnType<typeof getMyThreads>>[number];

/**
 * Unread messages across every live conversation, for the tab badge. The bell
 * carried a count and the Messages tab did not, so a parent had no way of
 * knowing a teacher had written without opening the list.
 * Never throws: a badge is not worth a 500 on every signed-in page.
 */
export async function getUnreadMessageCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_threads");
  if (error) return 0;
  return (data ?? [])
    .filter((thread) => !thread.archived)
    .reduce((total, thread) => total + Number(thread.unread_count ?? 0), 0);
}

export async function getThread(threadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("threads")
    .select(
      `id, school_id, kind, class_id, event_id, title, created_by, allow_replies, locked, archived, settings, last_message_at,
       class:classes ( id, name ),
       members:thread_members ( user_id, role, muted, last_read_at, profile:profiles ( id, first_name, last_name, avatar_path ) )`,
    )
    .eq("id", threadId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type ThreadDetail = NonNullable<Awaited<ReturnType<typeof getThread>>>;

const MESSAGE_SELECT = `
  id, thread_id, author_id, body, attachments, reply_to, edited_at, deleted_at, moderated_by, moderation_reason, created_at,
  reactions:message_reactions ( user_id, emoji )
` as const;

export async function getMessages(threadId: string, limit = 60) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

export type MessageRow = Awaited<ReturnType<typeof getMessages>>[number];

/**
 * The page before `before`, oldest first. The thread used to load exactly sixty
 * messages and stop: past that, history was unreachable and a quoted reply to an
 * older message rendered empty, because the quote is resolved among the
 * messages already loaded.
 */
export async function getMessagesBefore(threadId: string, before: string, limit = 40) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("thread_id", threadId)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function searchMessages(threadId: string, query: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("thread_id", threadId)
    .is("deleted_at", null)
    .textSearch("search", query, { type: "websearch", config: "public.french_unaccent" })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function getDmContacts() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dm_contacts");
  if (error) throw error;
  return data ?? [];
}

export async function getOpenReports(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select(
      `id, reason, status, created_at, resolved_at, resolution_note,
       reporter:profiles!reports_reporter_profile_fkey ( first_name, last_name ),
       message:messages ( id, body, deleted_at, thread_id, author:profiles!messages_author_profile_fkey ( first_name, last_name ) )`,
    )
    .eq("school_id", schoolId)
    .order("status")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}
