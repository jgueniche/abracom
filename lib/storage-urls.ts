import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { SIGNED_URL_TTL_SECONDS } from "@/lib/storage";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Signed URLs that stay the same from one render to the next.
 *
 * A signed URL carries the second it was issued, so signing the same file twice gives two
 * different addresses — and a browser that sees a new `src` downloads the picture again. Each
 * tick of « Fait » re-renders the diary (the action revalidates it), which re-signed every page
 * of the week: ten thumbnails downloaded again for one tap. Within a warm server instance, a URL
 * is now reused while it still has more than five minutes to live — the same five minutes the
 * client router keeps a page (`staleTimes.dynamic`), so a page read from that cache never
 * points at an expired picture.
 *
 * Only paths a caller has just read through its own, RLS-filtered query are ever signed here:
 * handing two readers of the same page the same URL gives neither of them anything the other
 * could not already open.
 */
const REUSE_MARGIN_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 4000;
const cache = new Map<string, { url: string; expiresAt: number }>();

export async function signedUrls(
  supabase: SupabaseClient<Database>,
  bucket: string,
  paths: readonly string[],
): Promise<Map<string, string>> {
  const now = Date.now();
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const path of new Set(paths)) {
    const hit = cache.get(`${bucket}/${path}`);
    if (hit && hit.expiresAt - now > REUSE_MARGIN_MS) out.set(path, hit.url);
    else missing.push(path);
  }
  if (missing.length === 0) return out;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.warn("[storage] signed urls:", error.message);
    return out;
  }
  const expiresAt = now + SIGNED_URL_TTL_SECONDS * 1000;
  for (const row of data ?? []) {
    if (!row.path || !row.signedUrl) continue;
    out.set(row.path, row.signedUrl);
    cache.set(`${bucket}/${row.path}`, { url: row.signedUrl, expiresAt });
  }
  if (cache.size > MAX_ENTRIES) {
    for (const [key, entry] of cache) {
      if (entry.expiresAt - now <= REUSE_MARGIN_MS || cache.size > MAX_ENTRIES) cache.delete(key);
      if (cache.size <= MAX_ENTRIES * 0.75) break;
    }
  }
  return out;
}
