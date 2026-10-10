"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { AttachmentView } from "@/lib/attachments";
import { deletePostMedia } from "@/server/actions/class-posts";

import { AttachmentViewer, useRefreshOnExpiredImage } from "./attachment-viewer";

/**
 * The grid of a cahier de vie entry. A photo used to open full size in a new browser tab — on a
 * phone, a second tab with no way back but the tab switcher; it now opens in the viewer, which
 * goes through every photo of the entry, the ones the list folded under « +3 » included.
 */
export function MediaGridView({
  items,
  title,
  canDelete,
  limit,
}: {
  items: Array<AttachmentView & { caption: string | null }>;
  title: string;
  canDelete: boolean;
  limit?: number;
}) {
  const t = useTranslations("classSpace.post");
  const tViewer = useTranslations("viewer");
  const refresh = useRefreshOnExpiredImage();
  const [index, setIndex] = useState<number | null>(null);
  const shown = limit ? items.slice(0, limit) : items;
  const remaining = items.length - shown.length;

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {shown.map((item, position) => {
          const ratio = item.width && item.height ? `${item.width} / ${item.height}` : "4 / 3";
          const isLast = position === shown.length - 1 && remaining > 0;
          return (
            <li
              key={item.id}
              className="relative overflow-hidden rounded-xl bg-muted"
              style={{ aspectRatio: ratio, backgroundColor: item.color ?? undefined }}
            >
              <button
                type="button"
                onClick={() => setIndex(position)}
                aria-label={tViewer("openPhoto", { n: position + 1, total: items.length })}
                className="block size-full"
              >
                {item.thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URLs from a private bucket
                  <img
                    src={item.thumbUrl}
                    alt={item.caption ?? ""}
                    loading="lazy"
                    decoding="async"
                    onError={refresh}
                    className="size-full object-cover"
                  />
                )}
                {isLast && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/55 text-base font-semibold text-background tabular-nums">
                    +{remaining}
                  </span>
                )}
              </button>
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
      <AttachmentViewer
        items={items}
        index={index}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
        title={title}
      />
    </>
  );
}
