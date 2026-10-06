"use client";

import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, PrinterIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";

import type { AttachmentView } from "@/lib/attachments";
import { cn } from "@/lib/utils";

/** A refresh asked by an expired picture, at most once a minute (signed URLs live ten). */
let lastRefresh = 0;
export function useRefreshOnExpiredImage() {
  const router = useRouter();
  return useCallback(() => {
    if (Date.now() - lastRefresh < 60_000) return;
    lastRefresh = Date.now();
    router.refresh();
  }, [router]);
}

/**
 * The full-screen look at a page or a photo.
 *
 * A thumbnail used to open the picture in a new tab — on a phone, a second browser tab with no
 * way back but the tab switcher, and nothing to print with. Here the picture fills the screen on
 * a dark ground, a swipe or the arrow keys go from one page to the next, and two buttons do what
 * a parent came for: print this page, or keep it. Printing prints the page alone, on its own
 * sheet, not a screenshot of the application around it.
 */
export function AttachmentViewer({
  items,
  index,
  onIndexChange,
  onClose,
  title,
}: {
  /** Pictures only — a PDF opens in the browser's own reader. */
  items: AttachmentView[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** What the pictures belong to: the homework's title, the author of a message. */
  title?: string;
}) {
  const t = useTranslations("viewer");
  const refresh = useRefreshOnExpiredImage();
  const open = index !== null && items.length > 0;
  const current = open ? items[Math.min(index, items.length - 1)] : undefined;
  const count = items.length;
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Once the reader has pinched into a page, a sideways drag is them reading along a line,
  // not asking for the next page.
  const [zoomed, setZoomed] = useState(false);

  const go = useCallback(
    (offset: number) => {
      if (index === null || count < 2) return;
      onIndexChange((index + offset + count) % count);
    },
    [count, index, onIndexChange],
  );

  useEffect(() => setLoaded(false), [current?.id]);

  useEffect(() => {
    const viewport = typeof window !== "undefined" ? window.visualViewport : null;
    if (!open || !viewport) return;
    const update = () => setZoomed(viewport.scale > 1.01);
    update();
    viewport.addEventListener("resize", update);
    return () => viewport.removeEventListener("resize", update);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  function print() {
    const root = document.documentElement;
    root.dataset.printScope = "viewer";
    const cleanup = () => {
      delete root.dataset.printScope;
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // Some mobile browsers return from print() before the sheet is closed, some never fire
    // `afterprint`: the attribute only matters while printing, so it goes in any case.
    window.setTimeout(cleanup, 60_000);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-print-keep
          className="fixed inset-0 z-50 bg-[oklch(0.16_0.02_256)] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Content
          data-print-keep
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col text-white outline-none data-open:animate-in data-open:fade-in-0"
        >
          <div
            data-viewer-chrome
            className="flex min-h-14 items-center gap-1 px-2 pt-[env(safe-area-inset-top)] sm:px-4"
          >
            <div className="min-w-0 flex-1 px-2">
              <DialogPrimitive.Title className="truncate font-sans text-sm font-semibold text-white">
                {title ?? current?.name ?? t("title")}
              </DialogPrimitive.Title>
              {count > 1 && (
                <p
                  className="sr-only text-xs text-white/75 tabular-nums sm:not-sr-only"
                  aria-live="polite"
                >
                  {t("position", { n: (index ?? 0) + 1, total: count })}
                </p>
              )}
            </div>
            <ViewerButton label={t("print")} onClick={print} wide>
              <PrinterIcon aria-hidden className="size-5" />
            </ViewerButton>
            {current && (
              <ViewerButton label={t("download")} href={current.downloadHref} wide>
                <DownloadIcon aria-hidden className="size-5" />
              </ViewerButton>
            )}
            <DialogPrimitive.Close className={viewerButtonClass()}>
              <XIcon aria-hidden className="size-5" />
              <span className="sr-only">{t("close")}</span>
            </DialogPrimitive.Close>
          </div>

          <div
            data-viewer-stage
            className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-3 sm:px-16"
            style={{ touchAction: zoomed ? "auto" : "pan-y pinch-zoom" }}
            onPointerDown={(event) => {
              swipe.current = zoomed ? null : { x: event.clientX, y: event.clientY };
            }}
            onPointerCancel={() => {
              swipe.current = null;
            }}
            onPointerUp={(event) => {
              const start = swipe.current;
              swipe.current = null;
              if (!start) return;
              const dx = event.clientX - start.x;
              const dy = event.clientY - start.y;
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
            }}
          >
            {current?.url && (
              <div
                className="relative flex max-h-full max-w-full items-center justify-center"
                style={{ backgroundColor: loaded ? undefined : (current.color ?? undefined) }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a signed URL from a private bucket */}
                <img
                  key={current.id}
                  data-viewer-image
                  src={current.url}
                  alt={current.name}
                  width={current.width ?? undefined}
                  height={current.height ?? undefined}
                  onLoad={() => setLoaded(true)}
                  onError={refresh}
                  draggable={false}
                  className={cn(
                    "max-h-[calc(100dvh-9rem)] w-auto max-w-full object-contain select-none sm:max-h-[calc(100dvh-6rem)]",
                    "transition-opacity duration-150",
                    loaded ? "opacity-100" : "opacity-0",
                  )}
                />
              </div>
            )}
            {count > 1 && (
              <>
                {/* Beside the picture on a wide screen; under it on a phone, where the thumb is. */}
                <ViewerButton
                  label={t("previous")}
                  onClick={() => go(-1)}
                  className="absolute top-1/2 left-3 hidden -translate-y-1/2 sm:inline-flex"
                >
                  <ChevronLeftIcon aria-hidden className="size-6" />
                </ViewerButton>
                <ViewerButton
                  label={t("next")}
                  onClick={() => go(1)}
                  className="absolute top-1/2 right-3 hidden -translate-y-1/2 sm:inline-flex"
                >
                  <ChevronRightIcon aria-hidden className="size-6" />
                </ViewerButton>
              </>
            )}
          </div>
          {count > 1 && (
            <div
              data-viewer-chrome
              className="flex items-center justify-center gap-6 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:hidden"
            >
              <ViewerButton label={t("previous")} onClick={() => go(-1)}>
                <ChevronLeftIcon aria-hidden className="size-6" />
              </ViewerButton>
              <span className="text-sm text-white/80 tabular-nums" aria-hidden>
                {(index ?? 0) + 1} / {count}
              </span>
              <ViewerButton label={t("next")} onClick={() => go(1)}>
                <ChevronRightIcon aria-hidden className="size-6" />
              </ViewerButton>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function viewerButtonClass(className?: string) {
  return cn(
    "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2.5 text-sm font-medium text-white",
    "bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white",
    className,
  );
}

function ViewerButton({
  label,
  children,
  onClick,
  href,
  wide = false,
  className,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  /** Shows the label beside the icon from `sm` up. */
  wide?: boolean;
  className?: string;
}) {
  const content = (
    <>
      {children}
      <span className={wide ? "sr-only sm:not-sr-only" : "sr-only"}>{label}</span>
    </>
  );
  if (href)
    return (
      <a href={href} className={viewerButtonClass(className)}>
        {content}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={viewerButtonClass(className)}>
      {content}
    </button>
  );
}
