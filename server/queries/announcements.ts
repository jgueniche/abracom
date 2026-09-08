import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Published announcements that require an acknowledgement the user has not given yet. */
export async function getPendingAcknowledgements(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, published_at, reads:announcement_reads ( user_id, acked_at )")
    .eq("requires_ack", true)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).filter(
    (a) => !a.reads.some((r) => r.user_id === userId && r.acked_at !== null),
  );
}
