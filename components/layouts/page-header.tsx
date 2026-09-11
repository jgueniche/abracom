import type { ReactNode } from "react";

import { HelpHint } from "@/components/layouts/help-hint";
import { cn } from "@/lib/utils";

/**
 * Page title block. The heading takes its size from the base layer (Fraunces,
 * 30/36 px) instead of re-declaring it, so the app has one typographic scale.
 * `eyebrow` carries the context line — who is speaking, which class, which day.
 * The "?" beside the title opens the article that documents this very screen;
 * it draws nothing when no article matches, which is exactly what the coverage
 * check refuses to let happen (ADR-0046).
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
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <div className="flex items-center gap-1">
          <h1>{title}</h1>
          <HelpHint />
        </div>
        {description && (
          <p className="text-[0.9375rem] text-pretty text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
