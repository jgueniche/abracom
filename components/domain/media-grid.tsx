import { XIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
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

/** Photos of a post: private bucket, batch-signed URLs (10 min), soft placeholder while loading. */
export async function MediaGrid({
  items,
  canDelete = false,
}: {
  items: MediaItem[];
  canDelete?: boolean;
}) {
  if (items.length === 0) return null;
  const t = await getTranslations("classSpace.post");
  const supabase = await createClient();
  const { data: signed } = await supabase.storage.from(BUCKETS.classMedia).createSignedUrls(
    items.map((m) => m.storage_path),
    SIGNED_URL_TTL_SECONDS,
  );
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => {
        const url = urls.get(item.storage_path);
        const ratio = item.width && item.height ? `${item.width} / ${item.height}` : "4 / 3";
        return (
          <li
            key={item.id}
            className="relative overflow-hidden rounded-xl bg-muted"
            style={{ aspectRatio: ratio }}
          >
            {url && (
              // eslint-disable-next-line @next/next/no-img-element -- signed URLs from a private bucket
              <img
                src={url}
                alt={item.caption ?? ""}
                loading="lazy"
                className="size-full object-cover"
                onContextMenu={undefined}
              />
            )}
            {item.caption && (
              <p className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 text-xs text-white">
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
                  className="size-8"
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
