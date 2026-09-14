"use client";

import { useLinkStatus } from "next/link";

/**
 * "J'ai entendu" — the bar that appears under the tab you just clicked, for as
 * long as the server is answering.
 *
 * A click used to produce nothing at all until the page had been rendered
 * server-side, which is exactly what "il y a de la latence dans les clics"
 * describes: not only slow, but silent. The obvious remedy — a `loading.tsx`
 * skeleton — was measured and rejected (ADR-0061): it does answer in 50 ms
 * instead of 200, but it splits the navigation into two round trips and the
 * page a reader actually wants then lands two to three times later. This costs
 * nothing at all: `useLinkStatus` is client state, the navigation is untouched,
 * and the mark sits exactly where the active mark sits, so the eye already
 * knows to look there.
 */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute h-[2px] animate-pulse rounded-full bg-primary/70 ${className}`}
    />
  );
}
