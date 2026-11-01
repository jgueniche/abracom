import { Link } from "@/components/ui/link";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

export type HubCardProps = {
  href: string;
  /** Kept in the signature for the callers' vocabulary; the row draws no icon. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
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
    <li className={className}>
      <Link
        href={href}
        prefetch={false}
        // On a phone the live figure goes under the description: set at the right, it squeezed
        // « Annonces et circulaires » into a column a third of the screen wide.
        className="group -mx-3 flex min-h-12 items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted focus-visible:bg-muted"
      >
        <span className="min-w-0 flex-1">
          {/* The title stays in ink: in red, « Annonces et circulaires » read as an error.
              What is waiting is the figure's to say, at the right (ADR-0080). */}
          <span className="block text-base font-semibold tracking-[-0.006em]">{title}</span>
          {hint && (
            <span className="mt-0.5 block text-[0.8125rem] text-muted-foreground">{hint}</span>
          )}
        </span>
        {meta && (
          // What waits is a small tag at the right of the line, the way Messages marks an unread
          // conversation — no longer a red title (ADR-0080).
          <span
            className={cn(
              "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              urgent ? "bg-brick/10 text-brick" : "bg-muted text-muted-foreground",
            )}
          >
            {meta}
          </span>
        )}
      </Link>
    </li>
  );
}

/**
 * The list a hub's entries live in. It drew a rule above the first entry and under every one;
 * the entries are now set apart by space, as the conversations are in Messages (ADR-0078).
 */
export function HubGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-0.5 lg:grid lg:grid-cols-2 lg:gap-x-10", className)}>
      {children}
    </ul>
  );
}
