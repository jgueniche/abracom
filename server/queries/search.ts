import "server-only";

import { createClient } from "@/lib/supabase/server";

export type SearchKind =
  "announcement" | "class_post" | "message" | "community" | "event" | "document";

/** Ranked full-text search across everything the caller may read (RLS inside `global_search`). */
export async function globalSearch(q: string, limit = 40) {
  const query = q.trim();
  if (query.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("global_search", { q: query, max_results: limit });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, kind: row.kind as SearchKind }));
}

export function hrefForResult(row: {
  kind: SearchKind;
  id: string;
  context_id: string | null;
}): string {
  switch (row.kind) {
    case "announcement":
      return `/annonces/${row.id}`;
    case "class_post":
      return row.context_id ? `/classes/${row.context_id}` : "/classes";
    case "message":
      return row.context_id ? `/messages/${row.context_id}` : "/messages";
    case "community":
      return `/communaute/annonces/${row.id}`;
    case "event":
      return `/agenda/${row.id}`;
    case "document":
      return "/documents";
  }
}
