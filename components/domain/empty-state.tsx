import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one way to say "there is nothing here yet".
 *
 * Twenty-six files wrote their own empty state by hand, almost all of them a
 * bare `<p class="text-sm text-muted-foreground">` with no explanation of what
 * would make content appear and no way out.
 *
 * It is deliberately small. An empty state describes an absence: when it is
 * built as a 200 px dashed panel with a 48 px medallion in it, the absence ends
 * up the loudest thing on the screen.
 */
function isLinkAction(action: unknown): action is { href: string; label: string } {
  return typeof action === "object" && action !== null && "href" in action && "label" in action;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description?: ReactNode;
  /** A link out of the dead end, or any control that gets content flowing. */
  action?: { href: string; label: string } | ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-border bg-card/60 px-6 py-8 text-center",
        className,
      )}
    >
      {Icon && <Icon className="mb-2.5 size-5 text-muted-foreground/60" aria-hidden />}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-[46ch] text-xs text-pretty text-muted-foreground">{description}</p>
      )}
      {action &&
        (isLinkAction(action) ? (
          <Button asChild variant="outline" className="mt-4">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <div className="mt-4">{action}</div>
        ))}
    </div>
  );
}
