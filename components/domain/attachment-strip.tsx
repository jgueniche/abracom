"use client";

import { FileTextIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { type AttachmentView, thumbRatio } from "@/lib/attachments";
import { formatBytes } from "@/lib/uploads/shared";
import { cn } from "@/lib/utils";

import { AttachmentViewer, useRefreshOnExpiredImage } from "./attachment-viewer";

/**
 * The pages and documents of a homework, where the homework is read.
 *
 * Pages were stored since session 7 and shown by no screen of the diary: a teacher who joined
 * the page of the revision book reached nobody. They are now a row of thumbnails under the
 * homework — light renditions, so a week of pages costs a few hundred kilobytes — that open the
 * viewer full screen; a PDF is a card that opens in the browser's own reader, where it prints.
 */
export function AttachmentStrip({
  items,
  title,
  size = "md",
  className,
}: {
  items: AttachmentView[];
  /** What the pages belong to: named in the viewer and in each thumbnail's label. */
  title: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const t = useTranslations("viewer");
  const locale = useLocale();
  const refresh = useRefreshOnExpiredImage();
  const [index, setIndex] = useState<number | null>(null);
  const images = items.filter((item) => item.kind === "image");
  const documents = items.filter((item) => item.kind === "pdf");
  if (items.length === 0) return null;

  return (
    <>
      <div className={cn("flex flex-col gap-2", className)}>
        {images.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {images.map((item, position) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setIndex(position)}
                  aria-label={t("openPage", { n: position + 1, total: images.length, title })}
                  className={cn(
                    "group/thumb relative block overflow-hidden rounded-md border border-border bg-muted",
                    "transition-[border-color,box-shadow] hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_22%)] hover:shadow-soft",
                    size === "lg" ? "h-40 sm:h-48" : "h-28",
                  )}
                  style={{
                    aspectRatio: thumbRatio(item),
                    backgroundColor: item.color ?? undefined,
                  }}
                >
                  {item.thumbUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- a signed URL from a private bucket
                    <img
                      src={item.thumbUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={refresh}
                      className="size-full object-cover transition-transform duration-200 group-hover/thumb:scale-[1.03]"
                    />
                  )}
                  {images.length > 1 && (
                    <span
                      aria-hidden
                      className="absolute right-1 bottom-1 rounded-sm bg-background/90 px-1 text-[0.6875rem] leading-4 font-semibold text-foreground tabular-nums"
                    >
                      {position + 1}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {documents.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {documents.map((item) => (
              <li key={item.id} className="max-w-full min-w-0">
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener"
                  className="flex min-h-11 max-w-full items-center gap-2 rounded-md border border-border bg-card px-3 text-sm transition-colors hover:bg-muted"
                >
                  <FileTextIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate font-medium">{item.name}</span>
                  <span className="meta shrink-0">
                    {t("pdf")}
                    {item.size !== null ? ` · ${formatBytes(item.size, locale)}` : ""}
                  </span>
                  <span className="sr-only">{t("opensInNewTab")}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <AttachmentViewer
        items={images}
        index={index}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
        title={title}
      />
    </>
  );
}
