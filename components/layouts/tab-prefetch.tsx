"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/**
 * Loads the navigation tabs **with their data** before they are clicked, and keeps them loaded
 * while someone is using the application (ADR-0076, ADR-0084).
 *
 * A `<Link>` prefetch is no help here: without a loading boundary (ADR-0072) it brings back the
 * route tree and nothing else, so every first click on a tab was a full round trip — session
 * check, function, two to ten queries, transfer — and the router cache, kept five minutes
 * (`staleTimes` in next.config.ts), made the second click instant and the click after a pause
 * slow again: the porteur's words, three sessions running.
 *
 * `router.prefetch(href)` asks for the whole page instead (a "full" prefetch), which the router
 * keeps for `staleTimes.static`. Asking again is free while that copy is fresh; once it has
 * expired, or once a mutation has emptied the cache (`revalidatePath`), the same call fetches
 * it anew. So the tabs are asked for:
 *
 * - **as soon as the page is on screen** — a tenth of a second after it mounts, the tabs a few
 *   dozen milliseconds apart. The first version waited for the browser to be idle, up to two
 *   seconds on a busy phone, and spaced the tabs a quarter of a second apart: the last tab was
 *   ready three seconds after the app opened, and "the first click is slow" was the click made
 *   in those three seconds (ADR-0084);
 * - after every navigation;
 * - **after every mutation**: a Server Action that revalidates empties the router cache, tabs
 *   included, and re-renders the layout — which hands this component a new `refreshKey`. The
 *   tabs used to wait for the next minute check, so the click after « Fait » was a round trip;
 * - when the application comes back to the foreground — the phone case of "I come back after a
 *   while and it is slow again";
 * - every minute while the page is visible and used, so that a copy expiring is replaced before
 *   the next click rather than by it.
 *
 * Nobody touching the page for ten minutes stops the minute check: a tab left open on a desk
 * does not render four pages every five minutes for no one. A data-saving connection never
 * prefetches. Rendering a page has no effect besides reading: read receipts and "seen" marks are
 * sent by the browser once a page is mounted, never by the server rendering it.
 */
const FIRST_AFTER_MS = 100;
const SPACING_MS = 60;
const CHECK_EVERY_MS = 60_000;
const ACTIVE_FOR_MS = 10 * 60_000;

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

export function TabPrefetch({
  hrefs,
  refreshKey,
}: {
  hrefs: string[];
  /** Changes whenever the server re-renders the layout: a full load, or a mutation. */
  refreshKey?: string | number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const lastActivity = useRef(0);
  const key = hrefs.join(" ");

  useEffect(() => {
    if (lastActivity.current === 0) lastActivity.current = Date.now();
    const tabs = key.split(" ").filter(Boolean);
    const timers = new Set<number>();
    const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    const warm = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivity.current > ACTIVE_FOR_MS) return;
      const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
      if (connection?.saveData || connection?.effectiveType?.endsWith("2g")) return;
      tabs
        .filter((href) => !isCurrent(href))
        .forEach((href, index) => {
          const timer = window.setTimeout(() => {
            timers.delete(timer);
            router.prefetch(href);
          }, index * SPACING_MS);
          timers.add(timer);
        });
    };

    const first = window.setTimeout(warm, FIRST_AFTER_MS);
    const interval = window.setInterval(warm, CHECK_EVERY_MS);

    const onActivity = () => {
      const wasAway = Date.now() - lastActivity.current > CHECK_EVERY_MS;
      lastActivity.current = Date.now();
      if (wasAway) warm();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      lastActivity.current = Date.now();
      warm();
    };
    const activity = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const type of activity) window.addEventListener(type, onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      for (const timer of timers) window.clearTimeout(timer);
      for (const type of activity) window.removeEventListener(type, onActivity);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [key, pathname, router, refreshKey]);

  return null;
}

/**
 * Starts loading a destination the moment a finger lands on its link (or a pointer rests on it),
 * not when the finger lifts: a tap takes 60 to 150 ms between the two, and the navigation that
 * follows picks up the request already in flight. Free when the page is already loaded.
 */
export function usePrefetchOnIntent() {
  const router = useRouter();
  return useCallback(
    (href: string) => ({
      onPointerDown: () => router.prefetch(href),
      onMouseEnter: () => router.prefetch(href),
    }),
    [router],
  );
}
