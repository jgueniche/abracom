"use client";

import { FileTextIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AttachmentViewer } from "@/components/domain/attachment-viewer";
import { type AttachmentView, messageMediaHref } from "@/lib/attachments";
import { isPhoto, type MessageAttachment } from "@/lib/messaging/format";
import { createClient } from "@/lib/supabase/client";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/storage";
import { formatBytes } from "@/lib/uploads/shared";
import { cn } from "@/lib/utils";

/**
 * Signed URLs for the photos of a conversation: those the server signed with the page, then —
 * for a message that arrives live or an older page loaded on demand — signed here in one batch.
 * A picture whose URL has expired (ten minutes) asks for a new one, twice at most.
 */
export function useSignedPhotos(initial: Record<string, string>, paths: readonly string[]) {
  const [urls, setUrls] = useState(() => new Map(Object.entries(initial)));
  const pending = useRef(new Set<string>());
  const retries = useRef(new Map<string, number>());
  const wanted = paths.join("|");

  useEffect(() => {
    const missing = wanted
      .split("|")
      .filter((path) => path && !urls.has(path) && !pending.current.has(path));
    if (missing.length === 0) return;
    for (const path of missing) pending.current.add(path);
    void createClient()
      .storage.from("messages")
      .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS)
      .then(({ data }) => {
        setUrls((current) => {
          const next = new Map(current);
          for (const row of data ?? [])
            if (row.path && row.signedUrl) next.set(row.path, row.signedUrl);
          return next;
        });
      })
      .finally(() => {
        for (const path of missing) pending.current.delete(path);
      });
  }, [wanted, urls]);

  const expired = useCallback((path: string) => {
    const count = retries.current.get(path) ?? 0;
    if (count >= 2) return;
    retries.current.set(path, count + 1);
    setUrls((current) => {
      if (!current.has(path)) return current;
      const next = new Map(current);
      next.delete(path);
      return next;
    });
  }, []);

  return { urls, expired };
}

/**
 * The files of one message. A photo used to be a paperclip and a file name, opened in a new
 * tab: a parent who shared the page of tonight's homework in the class group made every other
 * parent leave the conversation to read it. Photos now show in the thread — one large, or a
 * grid of four with the count of the rest — and open in the viewer, where they print.
 */
export function MessageAttachments({
  attachments,
  urls,
  onExpired,
  title,
  mine,
}: {
  attachments: MessageAttachment[];
  urls: ReadonlyMap<string, string>;
  onExpired: (path: string) => void;
  /** Who sent them, for the viewer's title. */
  title: string;
  mine: boolean;
}) {
  const t = useTranslations("viewer");
  const locale = useLocale();
  const [index, setIndex] = useState<number | null>(null);
  const photos = attachments.filter(isPhoto);
  const files = attachments.filter((attachment) => !isPhoto(attachment));

  const views = useMemo<AttachmentView[]>(
    () =>
      photos.map((photo) => ({
        id: photo.path,
        kind: "image",
        name: photo.name,
        size: photo.size,
        width: photo.width ?? null,
        height: photo.height ?? null,
        color: photo.color ?? null,
        thumbUrl: (photo.thumb && urls.get(photo.thumb)) || urls.get(photo.path) || null,
        url: urls.get(photo.path) ?? null,
        href: messageMediaHref(photo.path),
        downloadHref: messageMediaHref(photo.path, photo.name, true),
      })),
    [photos, urls],
  );

  const shown = views.slice(0, 4);
  const rest = views.length - shown.length;

  return (
    <div className="flex flex-col gap-1.5">
      {shown.length === 1 ? (
        <PhotoButton
          view={shown[0]!}
          label={t("openPhoto", { n: 1, total: 1 })}
          onOpen={() => setIndex(0)}
          onExpired={() => onExpired(photos[0]!.thumb ?? photos[0]!.path)}
          style={{
            aspectRatio:
              shown[0]!.width && shown[0]!.height
                ? `${Math.min(4 / 3, Math.max(3 / 5, shown[0]!.width / shown[0]!.height))}`
                : "4 / 3",
          }}
          className="w-full"
        />
      ) : shown.length > 1 ? (
        <ul className="grid w-full grid-cols-2 gap-1">
          {shown.map((view, position) => (
            <li key={view.id} className="relative">
              <PhotoButton
                view={view}
                label={t("openPhoto", { n: position + 1, total: views.length })}
                onOpen={() => setIndex(position)}
                onExpired={() => onExpired(photos[position]!.thumb ?? photos[position]!.path)}
                className="aspect-square w-full"
              />
              {position === shown.length - 1 && rest > 0 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/50 text-base font-semibold text-white tabular-nums"
                >
                  +{rest}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((file) => (
            <li key={file.path}>
              <a
                href={messageMediaHref(file.path)}
                target="_blank"
                rel="noopener"
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-md px-2 text-sm underline-offset-2 hover:underline",
                  mine ? "bg-primary-foreground/12" : "bg-muted",
                )}
              >
                <FileTextIcon aria-hidden className="size-4 shrink-0" />
                <span className="min-w-0 truncate font-medium">{file.name}</span>
                {file.size > 0 && (
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      mine ? "opacity-80" : "text-muted-foreground",
                    )}
                  >
                    {formatBytes(file.size, locale)}
                  </span>
                )}
                <span className="sr-only">{t("opensInNewTab")}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <AttachmentViewer
        items={views}
        index={index}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
        title={title}
      />
    </div>
  );
}

function PhotoButton({
  view,
  label,
  onOpen,
  onExpired,
  className,
  style,
}: {
  view: AttachmentView;
  label: string;
  onOpen: () => void;
  onExpired: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={cn("block overflow-hidden rounded-md bg-muted", className)}
      style={{ ...style, backgroundColor: view.color ?? undefined }}
    >
      {view.thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a signed URL from a private bucket
        <img
          src={view.thumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={onExpired}
          className="size-full object-cover"
        />
      )}
    </button>
  );
}
