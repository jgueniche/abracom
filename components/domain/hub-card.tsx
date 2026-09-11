import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

export type HubCardProps = {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  hint?: string;
  /** Short live figure — "3 accusés en attente" — shown at the far right. */
  meta?: ReactNode;
  /** Draws attention: something is actually waiting on the reader. */
  urgent?: boolean;
  className?: string;
};

/**
 * One destination in a section hub (École, Publier, Communauté).
 *
 * It is a line in a table of contents, not a tile. École held five links as
 * five 950 px boxes over two rows, with a thousand pixels of empty page under
 * them; the same five links as a list take a fifth of the height, put every
 * title on the same left edge where the eye can run down them, and keep the
 * live figure — « 2 accusés en attente » — at the far right where a figure
 * belongs.
 *
 * The icon each card used to wear went with the tile. A hub of five entries
 * needs no pictograms to be read: the names are the navigation. The prop stays
 * in the signature because it is the callers' vocabulary and because the mobile
 * tab bar still uses the same glyphs.
 */
export function HubCard({ href, title, hint, meta, urgent, className }: HubCardProps) {
  return (
    <li className={cn("border-b border-rule", className)}>
      <Link
        href={href}
        className="group -mx-3 flex min-h-14 items-baseline gap-4 rounded-md px-3 py-3.5 transition-colors hover:bg-muted/50"
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-base font-semibold tracking-[-0.006em]",
              urgent && "text-brick",
            )}
          >
            {title}
          </span>
          {hint && <span className="mt-0.5 block text-sm text-muted-foreground">{hint}</span>}
        </span>
        {meta && (
          <span
            className={cn(
              "shrink-0 text-xs font-semibold tabular-nums",
              urgent ? "text-brick" : "text-muted-foreground",
            )}
          >
            {meta}
          </span>
        )}
        <ChevronRightIcon
          className="size-3.5 shrink-0 self-center text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </li>
  );
}

/** The list a hub's entries live in. */
export function HubGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("border-t border-rule", className)}>{children}</ul>;
}
