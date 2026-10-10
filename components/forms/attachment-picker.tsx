"use client";

import {
  AlertCircleIcon,
  CameraIcon,
  FileTextIcon,
  Loader2Icon,
  PaperclipIcon,
  RotateCwIcon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type DragEvent, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/uploads/shared";
import { cn } from "@/lib/utils";

import type { UploadItem, useUploads } from "./use-uploads";

type Uploads = ReturnType<typeof useUploads>;

/**
 * Where a teacher joins a page, a worksheet or a photo.
 *
 * Two doors, named for what they do: **photograph** — which opens the camera on a phone, so a
 * page is one tap and one shot away — and **add a file**, for the PDF already on the computer
 * or the photo already in the gallery. On a desk, files can also be dropped on the zone. Each
 * file shows its own progress the moment it is chosen; nothing waits for the form to be sent.
 */
export function AttachmentPicker({
  uploads,
  label,
  hint,
  cameraLabel,
  allowPdf,
  rotatable = false,
  name = "uploads",
  /** Shown before anything is chosen, under the buttons. */
  children,
}: {
  uploads: Uploads;
  label: string;
  hint?: string;
  cameraLabel: string;
  allowPdf: boolean;
  /** Offer a quarter turn per photo — a page shot from above often comes out sideways. */
  rotatable?: boolean;
  /** The hidden field the descriptions travel in. */
  name?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("attachments");
  const id = useId();
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const accept = allowPdf ? "image/*,application/pdf" : "image/*";

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    uploads.add(event.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-2">
      <p id={`${id}-label`} className="text-sm leading-none font-medium">
        {label}
      </p>
      {hint && <p className="-mt-0.5 text-xs text-pretty text-muted-foreground">{hint}</p>}
      <input type="hidden" name={name} value={JSON.stringify(uploads.classUploads)} />
      <div
        role="group"
        aria-labelledby={`${id}-label`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col gap-3 rounded-lg border border-dashed border-input/70 p-3 transition-colors",
          dragging && "border-primary bg-primary/5",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* `capture` opens the camera on a phone; a desktop browser ignores it and shows the
              file picker, so the button is only offered where there is a camera to open. */}
          <Button
            type="button"
            variant="outline"
            className="hidden min-h-11 any-pointer-coarse:inline-flex"
            onClick={() => camera.current?.click()}
          >
            <CameraIcon aria-hidden />
            {cameraLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => picker.current?.click()}
          >
            <PaperclipIcon aria-hidden />
            {allowPdf ? t("addFiles") : t("addPhotos")}
          </Button>
          <span className="hidden text-xs text-muted-foreground pointer-fine:inline">
            {t("dropHint")}
          </span>
          <input
            ref={camera}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              uploads.add(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={picker}
            type="file"
            accept={accept}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              uploads.add(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </div>

        {uploads.items.length === 0 ? (
          children
        ) : (
          <ul className="flex flex-wrap gap-2">
            {uploads.items.map((item, index) => (
              <li key={item.id}>
                <Tile
                  item={item}
                  index={index}
                  rotatable={rotatable}
                  onRemove={() => uploads.remove(item.id)}
                  onRotate={() => uploads.rotate(item.id)}
                  onRetry={() => uploads.retry(item.id)}
                />
              </li>
            ))}
          </ul>
        )}
        {uploads.refusal && (
          <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircleIcon className="mt-px size-3.5 shrink-0" aria-hidden />
            {t(`refusal.${uploads.refusal}`)}
          </p>
        )}
      </div>
    </div>
  );
}

function Tile({
  item,
  index,
  rotatable,
  onRemove,
  onRotate,
  onRetry,
}: {
  item: UploadItem;
  index: number;
  rotatable: boolean;
  onRemove: () => void;
  onRotate: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("attachments");
  const locale = useLocale();
  const label = item.kind === "image" ? t("pageN", { n: index + 1 }) : item.name;
  const working = item.status === "preparing" || item.status === "uploading";
  const percent = Math.round(item.progress * 100);

  return (
    <div
      className={cn(
        "relative flex h-32 flex-col overflow-hidden rounded-md border bg-muted",
        item.kind === "image" ? "w-24" : "w-44",
        item.status === "error" ? "border-destructive" : "border-border",
      )}
      aria-busy={working}
    >
      {item.kind === "image" ? (
        item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview
          <img
            src={item.previewUrl}
            alt={label}
            className="size-full object-cover transition-transform duration-200"
            style={{ transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined }}
          />
        ) : (
          <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
            {label}
          </span>
        )
      ) : (
        <div className="flex size-full flex-col justify-between bg-card p-2.5 pr-11">
          <FileTextIcon className="size-5 text-muted-foreground" aria-hidden />
          <span className="flex flex-col">
            <span className="line-clamp-2 text-xs font-medium break-all">{item.name}</span>
            {item.size !== undefined && (
              <span className="meta">{formatBytes(item.size, locale)}</span>
            )}
          </span>
        </div>
      )}

      {/* State, in words for a screen reader and as a two-pixel rule for the eye. */}
      <span className="sr-only" role="status">
        {item.status === "preparing"
          ? t("preparing")
          : item.status === "uploading"
            ? t("uploading", { percent })
            : item.status === "done"
              ? t("ready", { name: label })
              : t(`error.${item.error ?? "failed"}`)}
      </span>
      {working && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-foreground/10">
          <span
            className={cn(
              "block h-full bg-primary transition-[width] duration-200",
              item.status === "preparing" && "w-1/4 animate-pulse",
            )}
            style={item.status === "uploading" ? { width: `${Math.max(6, percent)}%` } : undefined}
          />
        </span>
      )}
      {working && (
        <span
          aria-hidden
          className="absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-background/85"
        >
          <Loader2Icon className="size-3.5 animate-spin text-primary" />
        </span>
      )}

      {item.status === "error" && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-background/92 p-1.5">
          <span className="text-[0.6875rem] leading-tight text-destructive">
            {t(`error.${item.error ?? "failed"}`)}
          </span>
          {item.error !== "type" && item.error !== "tooLarge" && item.error !== "forbidden" && (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-8 rounded-sm border border-border bg-card px-2 text-xs font-medium hover:bg-muted"
            >
              {t("retry")}
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={t("remove", { name: label })}
        className="absolute top-0 right-0 flex size-11 items-start justify-end p-1.5"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-soft ring-1 ring-border hover:bg-background">
          <XIcon className="size-3.5" aria-hidden />
        </span>
      </button>
      {rotatable && item.kind === "image" && item.status !== "error" && (
        <button
          type="button"
          onClick={onRotate}
          aria-label={t("rotate", { name: label })}
          className="absolute bottom-0 left-0 flex size-11 items-end justify-start p-1.5"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-soft ring-1 ring-border hover:bg-background">
            <RotateCwIcon className="size-3.5" aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}
