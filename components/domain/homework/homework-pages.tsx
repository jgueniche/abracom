"use client";

import { DownloadIcon, FileTextIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { AttachmentViewer, useRefreshOnExpiredImage } from "@/components/domain/attachment-viewer";
import type { AttachmentView } from "@/lib/attachments";
import { formatBytes } from "@/lib/uploads/shared";

/**
 * The pages of one homework, at the width of the column — readable as they are on a phone, and
 * printed one per sheet (`data-print-pages`, app/globals.css). A tap opens the viewer for a closer
 * look; the documents follow as rows that open in the browser's reader or download.
 */
export function HomeworkPages({ items, title }: { items: AttachmentView[]; title: string }) {
  const t = useTranslations("viewer");
  const locale = useLocale();
  const refresh = useRefreshOnExpiredImage();
  const [index, setIndex] = useState<number | null>(null);
  const images = items.filter((item) => item.kind === "image");
  const documents = items.filter((item) => item.kind === "pdf");

  return (
    <>
      {images.length > 0 && (
        <ol data-print-pages className="flex flex-col gap-4">
          {images.map((item, position) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setIndex(position)}
                aria-label={t("openPage", { n: position + 1, total: images.length, title })}
                className="block w-full overflow-hidden rounded-lg border border-border bg-muted print:border-0"
                style={{
                  aspectRatio:
                    item.width && item.height ? `${item.width} / ${item.height}` : undefined,
                  backgroundColor: item.color ?? undefined,
                }}
              >
                {item.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- a signed URL from a private bucket
                  <img
                    src={item.url}
                    alt=""
                    width={item.width ?? undefined}
                    height={item.height ?? undefined}
                    loading={position === 0 ? "eager" : "lazy"}
                    decoding="async"
                    onError={refresh}
                    className="block h-auto w-full"
                  />
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
      {documents.length > 0 && (
        <ul className="no-print mt-4 divide-y divide-rule overflow-hidden rounded-lg border border-border">
          {documents.map((item) => (
            <li key={item.id} className="flex items-center gap-1">
              <a
                href={item.href}
                target="_blank"
                rel="noopener"
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted"
              >
                <FileTextIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="meta">
                    {t("pdf")}
                    {item.size !== null ? ` · ${formatBytes(item.size, locale)}` : ""}
                  </span>
                </span>
                <span className="sr-only">{t("opensInNewTab")}</span>
              </a>
              <a
                href={item.downloadHref}
                aria-label={`${t("download")} ${item.name}`}
                className="mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <DownloadIcon aria-hidden className="size-4" />
              </a>
            </li>
          ))}
        </ul>
      )}
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
