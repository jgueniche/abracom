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

/** One destination in a section hub (École, Publier, Communauté). */
export function HubCard({ href, icon: Icon, title, hint, meta, urgent, className }: HubCardProps) {
  return (
    <Link href={href} className={cn("group block", className)}>
      <Card
        className={cn(
          "h-full transition-colors group-hover:border-primary/40 group-hover:bg-accent/40",
          urgent && "border-brick/40",
        )}
      >
        <CardHeader className="flex flex-row items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
              urgent ? "bg-brick/10 text-brick" : "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {hint && <CardDescription className="mt-0.5">{hint}</CardDescription>}
            {meta && (
              <p
                className={cn(
                  "mt-2 text-sm font-semibold",
                  urgent ? "text-brick" : "text-muted-foreground",
                )}
              >
                {meta}
              </p>
            )}
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}

/** Responsive grid for hub cards — two up on tablet, three from `xl`. */
export function HubGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}>{children}</div>
  );
}
