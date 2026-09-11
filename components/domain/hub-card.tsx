import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type HubCardProps = {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  hint?: string;
  /** Short live figure — "3 accusés en attente" — shown under the hint. */
  meta?: ReactNode;
  /** Draws attention: something is actually waiting on the reader. */
  urgent?: boolean;
  className?: string;
};

/**
 * One destination in a section hub (École, Publier, Communauté).
 *
 * The 40 px tinted square that used to hold the icon is gone. It was pure
 * furniture — five of them in a row painted a third of the hub in pale blue and
 * said nothing a 16 px glyph does not say — and a grid of tinted tiles is the
 * most recognisable shape in generic product design. What is left is the line a
 * reader actually reads, a chevron that says it goes somewhere, and the tint
 * kept for the one card that has something waiting on it.
 */
export function HubCard({ href, icon: Icon, title, hint, meta, urgent, className }: HubCardProps) {
  return (
    <Link href={href} className={cn("group block rounded-xl", className)}>
      <Card
        className={cn(
          "h-full transition-colors [--card-spacing:--spacing(3.5)] group-hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_16%)] group-hover:bg-muted/40",
          urgent && "border-l-2 border-l-brick",
        )}
      >
        <CardHeader className="flex flex-row items-start gap-2.5">
          <Icon
            className={cn(
              "mt-0.5 size-4 shrink-0 transition-colors",
              urgent ? "text-brick" : "text-muted-foreground group-hover:text-foreground",
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <CardTitle>{title}</CardTitle>
            {hint && <CardDescription className="mt-1">{hint}</CardDescription>}
            {meta && (
              <p
                className={cn(
                  "mt-2 text-xs font-semibold tabular-nums",
                  urgent ? "text-brick" : "text-muted-foreground",
                )}
              >
                {meta}
              </p>
            )}
          </div>
          <ChevronRightIcon
            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </CardHeader>
      </Card>
    </Link>
  );
}

/** Responsive grid for hub cards — two up on tablet, three from `xl`. */
export function HubGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>{children}</div>
  );
}
