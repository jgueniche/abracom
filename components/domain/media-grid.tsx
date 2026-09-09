import { XIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { blurhashAverageColor } from "@/lib/media";
import { BUCKETS, SIGNED_URL_TTL_SECONDS } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { deletePostMedia } from "@/server/actions/class-posts";

export type MediaItem = {
  id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  caption: string | null;
};

/**
 * Photos of a post: private bucket, batch-signed URLs (10 min), blurhash colour
 * behind each frame while it loads. In a list the grid stops at `limit` and
 * says how many are left, instead of printing twelve full-size thumbnails.
 */
export async function MediaGrid({
  items,
  canDelete = false,
  limit,
}: {
  items: MediaItem[];
  canDelete?: boolean;
  limit?: number;
}) {
  if (items.length === 0) return null;
  const t = await getTranslations("classSpace.post");
  const shown = limit ? items.slice(0, limit) : items;
  const remaining = items.length - shown.length;
  const supabase = await createClient();
  const { data: signed } = await supabase.storage.from(BUCKETS.classMedia).createSignedUrls(
    shown.map((m) => m.storage_path),
    SIGNED_URL_TTL_SECONDS,
  );
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {shown.map((item, index) => {
        const url = urls.get(item.storage_path);
        const ratio = item.width && item.height ? `${item.width} / ${item.height}` : "4 / 3";
        const placeholder = blurhashAverageColor(item.blurhash);
        const isLast = index === shown.length - 1 && remaining > 0;
        return (
          <li
            key={item.id}
            className="relative overflow-hidden rounded-xl bg-muted"
            style={{ aspectRatio: ratio, backgroundColor: placeholder ?? undefined }}
          >
            {url && (
              // The photo opens full size in a new tab — the grid used to be a
              // dead end: no zoom, no way to look at a picture properly.
              <a href={url} target="_blank" rel="noreferrer" className="block size-full">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs from a private bucket */}
                <img
                  src={url}
                  alt={item.caption ?? ""}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </a>
            )}
            {isLast && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/55 text-lg font-bold text-background">
                +{remaining}
              </span>
            )}
            {item.caption && !isLast && (
              <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-foreground/60 px-2 py-1 text-xs text-background">
                {item.caption}
              </p>
            )}
            {canDelete && (
              <form action={deletePostMedia} className="absolute top-1 right-1">
                <input type="hidden" name="mediaId" value={item.id} />
                <Button
                  type="submit"
                  size="icon"
                  variant="secondary"
                  className="size-11 md:size-8"
                  aria-label={t("deleteMedia")}
                >
                  <XIcon className="size-4" />
                </Button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
