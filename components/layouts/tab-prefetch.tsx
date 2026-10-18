"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Loads the navigation tabs **with their data** before they are clicked, and keeps them loaded
 * while someone is using the application (ADR-0076).
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
 * - once the page has settled (idle callback), one after the other rather than all at once;
 * - after every navigation;
 * - when the application comes back to the foreground — the phone case of "I come back after a
 *   while and it is slow again";
 * - every minute while the page is visible and used, so that a copy expiring or emptied by a
 *   mutation is replaced before the next click rather than by it.
 *
 * Nobody touching the page for ten minutes stops the minute check: a tab left open on a desk
 * does not render four pages every five minutes for no one. A data-saving connection never
 * prefetches. Rendering a page has no effect besides reading: read receipts and "seen" marks are
 * sent by the browser once a page is mounted, never by the server rendering it.
 */
const CHECK_EVERY_MS = 60_000;
const ACTIVE_FOR_MS = 10 * 60_000;
const SPACING_MS = 250;

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

export function TabPrefetch({ hrefs }: { hrefs: string[] }) {
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

    // Once the page has settled: the tabs wait for what the reader asked for, not the reverse.
    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = hasIdle
      ? window.requestIdleCallback(warm, { timeout: 2_000 })
      : window.setTimeout(warm, 1_000);
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
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      window.clearInterval(interval);
      for (const timer of timers) window.clearTimeout(timer);
      for (const type of activity) window.removeEventListener(type, onActivity);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [key, pathname, router]);

  return null;
}
