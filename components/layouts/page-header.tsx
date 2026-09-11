import type { ReactNode } from "react";

import { HelpHint } from "@/components/layouts/help-hint";
import { cn } from "@/lib/utils";

/**
 * The title block of a screen — one per page, and the only place in the
 * application where type is set at display size.
 *
 * Three lines, always in the same order and at the same sizes: the dateline
 * (who is speaking, which class, which week), the title, and one sentence of
 * description held to a readable measure. The block used to align its actions
 * to the *bottom* of the whole column, so a page with a description pushed its
 * buttons a line and a half below the title they belong to; they now hang off
 * the title itself.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <div className="flex items-center gap-1.5">
          <h1>{title}</h1>
          <HelpHint />
        </div>
        {description && (
          <p className="measure mt-1.5 text-sm text-pretty text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:mt-1">{actions}</div>
      )}
    </div>
  );
}
