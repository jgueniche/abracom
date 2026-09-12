import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A filter, written once.
 *
 * Six screens had each rolled the same control by hand — `min-h-11
 * rounded-full border px-4`, filled solid primary when selected — and the row
 * came out as a line of blue capsules that outweighed the page's own action.
 *
 * A filter is a state, not a command: selected is a tint and a ring of its own
 * colour, the rest is a plain outlined tag. The touch target stays at 44 px on
 * a phone and drops to 32 px where a pointer is doing the work.
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
        "inline-flex min-h-11 shrink-0 items-center rounded-md border px-3 text-sm font-medium whitespace-nowrap transition-colors md:min-h-9",
        active
          ? "border-primary/45 bg-primary/10 font-semibold text-primary"
          : "border-border bg-card text-foreground/70 hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_18%)] hover:text-foreground",
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
      className={cn("-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-0.5", className)}
    >
      {children}
    </nav>
  );
}
