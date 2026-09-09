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
 */
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
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <p className="font-heading text-lg tracking-tight">{title}</p>
      {description && (
        <p className="mt-1 max-w-prose text-sm text-balance text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button asChild className="mt-4 min-h-11">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
