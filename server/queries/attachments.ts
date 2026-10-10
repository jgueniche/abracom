import "server-only";

import { type AttachmentView, classMediaHref } from "@/lib/attachments";
import { blurhashAverageColor } from "@/lib/blurhash";
import { BUCKETS } from "@/lib/storage";
import { signedUrls } from "@/lib/storage-urls";
import { createClient } from "@/lib/supabase/server";

type MediaRow = {
  id: string;
  storage_path: string;
  thumb_path: string | null;
  kind: "image" | "video" | "pdf";
  width: number | null;
  height: number | null;
  blurhash: string | null;
  filename: string | null;
  size_bytes: number | null;
};

/**
 * The files of several publications, ready to display: every thumbnail and every full-size
 * picture signed in one request (and reused across renders, see `signedUrls`), every link going
 * through the route that signs on click. Videos are not shown: nothing writes them yet.
 */
export async function attachmentViews(
  rows: readonly MediaRow[],
): Promise<Map<string, AttachmentView>> {
  const views = new Map<string, AttachmentView>();
  const shown = rows.filter((row) => row.kind === "image" || row.kind === "pdf");
  if (shown.length === 0) return views;
  const images = shown.filter((row) => row.kind === "image");
  const supabase = await createClient();
  const urls = await signedUrls(
    supabase,
    BUCKETS.classMedia,
    images.flatMap((row) =>
      row.thumb_path ? [row.storage_path, row.thumb_path] : [row.storage_path],
    ),
  );
  for (const row of shown) {
    const url = row.kind === "image" ? (urls.get(row.storage_path) ?? null) : null;
    views.set(row.id, {
      id: row.id,
      kind: row.kind === "pdf" ? "pdf" : "image",
      name: row.filename ?? row.storage_path.split("/").pop() ?? "fichier",
      size: row.size_bytes,
      width: row.width,
      height: row.height,
      color: blurhashAverageColor(row.blurhash),
      thumbUrl: row.thumb_path ? (urls.get(row.thumb_path) ?? url) : url,
      url,
      href: classMediaHref(row.storage_path),
      downloadHref: classMediaHref(row.storage_path, true),
    });
  }
  return views;
}
