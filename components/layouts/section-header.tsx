import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The one way a page names a section.
 *
 * Twenty-one `<h2>` were written by hand across the application, at six
 * different sizes (`text-2xl`, `text-xl`, `text-lg`, `text-base`, `font-medium`,
 * the bare base style) and four different margins — and the largest of them was
 * set bigger than the page title it sat under. None of that was a decision;
 * each one was whatever the file next to it happened to do.
 *
 * A section is not a second title. It is a label, a count, a rule that carries
 * the eye to the far edge, and — if there is one — the way out of the section,
 * set at the right end where a reader looks for it. The rule is what gives a
 * screen its structure once the headings stop shouting.
 */
export function SectionHeader({
  label,
  count,
  hint,
  action,
  id,
  className,
}: {
  label: ReactNode;
  /** A live figure beside the label — "3", "12 / 27". Never a sentence. */
  count?: ReactNode;
  /** One line under the rule, when the label alone is not enough. */
  hint?: ReactNode;
  /** The way out of the section: a link, a small button. */
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-3", className)}>
      <div className="flex min-h-7 items-center gap-3">
        <h2 id={id} className="section-label min-w-0">
          {label}
        </h2>
        {count !== undefined && count !== null && (
          <span className="meta shrink-0 tabular-nums">{count}</span>
        )}
        <span aria-hidden className="h-px min-w-4 flex-1 bg-rule" />
        {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
      </div>
      {hint && <p className="mt-1.5 text-xs text-pretty text-muted-foreground">{hint}</p>}
    </div>
  );
}
