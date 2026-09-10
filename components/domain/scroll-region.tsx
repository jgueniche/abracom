import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A container that scrolls, reachable from the keyboard.
 *
 * Wide tables and long signature lists were plain `overflow-*` divs: with no
 * focusable element of their own and none inside, they could only be scrolled
 * with a pointer (axe `scrollable-region-focusable`, WCAG 2.1.1). A tab stop
 * and a name are all they need.
 */
export function ScrollRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={label}
      className={cn(
        "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
