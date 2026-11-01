import { Link } from "@/components/ui/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A filter, written once.
 *
 * Six screens had each rolled the same control by hand — `min-h-11
 * rounded-full border px-4`, filled solid primary when selected — and the row
 * came out as a line of blue capsules that outweighed the page's own action.
 *
 * A filter is a state, not a command. Only the selected one has a shape — a
 * tint of its own colour; the others are words that tint under the pointer. A
 * row of outlined tags was one more row of rectangles above a page of them
 * (ADR-0078). The touch target stays at 44 px on a phone and drops to 36 px
 * where a pointer is doing the work.
 */
export function FilterChip({
  href,
  active = false,
  children,
  className,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // 32 px to the eye, 44 to the finger: the extra 6 px above and below are an invisible
        // extension of the target, so a filter no longer reads as a button bar (ADR-0080).
        "relative inline-flex min-h-8 shrink-0 items-center rounded-full border px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
        "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] md:before:hidden",
        active
          ? "border-primary/25 bg-primary/10 font-semibold text-primary"
          : "border-border text-foreground/75 hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** The scrolling row a set of filters lives in, bled to the screen edges. */
export function FilterChips({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "-mx-4 mb-3 flex gap-1.5 overflow-x-auto overflow-y-hidden px-4 py-1.5",
        className,
      )}
    >
      {children}
    </nav>
  );
}
