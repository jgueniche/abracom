import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The one anatomy every piece of published content uses:
 * eyebrow · title · excerpt · media · footer, with at most one primary action.
 *
 * This is where the serif speaks. A card that carries something a person at the
 * school wrote — an announcement, a post, a note home — sets its title in the
 * editorial face; a card that carries an interface object (a destination, a
 * setting, a figure) sets it in the sans, through `CardTitle`. That distinction
 * is the whole job of having two families, and it dies the moment every heading
 * in the application is a display serif.
 *
 * The excerpt runs two lines, not three: in a grid, the third line was what
 * made every card a different height and none of them scannable.
 */
export function ContentCard({
  eyebrow,
  title,
  href,
  excerpt,
  body,
  media,
  footer,
  menu,
  /** Something is waiting on the reader: a brick rule down the edge. */
  accent = false,
  unread = false,
  muted = false,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  href?: string;
  excerpt?: string;
  body?: ReactNode;
  media?: ReactNode;
  footer?: ReactNode;
  menu?: ReactNode;
  accent?: boolean;
  unread?: boolean;
  muted?: boolean;
  className?: string;
}) {
  const heading = (
    <h3 className="font-heading text-[1.0625rem] leading-[1.32] font-normal tracking-[-0.008em] text-balance sm:text-[1.125rem]">
      {title}
    </h3>
  );

  return (
    <Card
      className={cn(
        "relative h-full",
        href &&
          "transition-colors focus-within:border-[color-mix(in_oklch,var(--border),var(--foreground)_16%)] focus-within:bg-muted/40 hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_16%)] hover:bg-muted/40",
        // A marked passage rather than a banner across the top: it says "this
        // one is for you" without repainting a sixth of the card.
        accent && "border-l-2 border-l-brick",
        muted && "border-rule bg-card/60",
        className,
      )}
    >
      <CardHeader>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="eyebrow mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                {unread && <span className="size-1.5 shrink-0 rounded-full bg-brick" aria-hidden />}
                {eyebrow}
              </p>
            )}
            {href ? (
              // The title line was the only target: 25 px tall on the list a
              // parent opens most, well under the 44 px the project sets itself.
              // The overlay makes the whole card the target, as a card should be.
              <Link
                href={href}
                className="group/title block after:absolute after:inset-0 hover:underline hover:decoration-foreground/25 hover:underline-offset-[3px]"
              >
                {heading}
              </Link>
            ) : (
              heading
            )}
          </div>
          {menu && <div className="relative z-10 -mt-1 shrink-0">{menu}</div>}
        </div>
      </CardHeader>
      {(excerpt || body || media) && (
        // Whatever a caller puts in `body` or `media` may be interactive — a
        // "seen" toggle, a photo to enlarge — so it stays above the overlay that
        // makes the rest of the card a target. A plain excerpt does not.
        <CardContent className={cn("flex flex-col gap-3", (body || media) && "relative z-10")}>
          {excerpt && (
            <p className="line-clamp-2 font-serif text-[0.9375rem] leading-[1.55] text-pretty text-muted-foreground">
              {excerpt}
            </p>
          )}
          {body}
          {media}
        </CardContent>
      )}
      {footer && (
        <CardContent className="relative z-10 flex flex-wrap items-center gap-1.5 border-t border-rule pt-2.5">
          {footer}
        </CardContent>
      )}
    </Card>
  );
}

/** Separator between eyebrow segments. */
export function EyebrowDot() {
  return <span className="size-[3px] rounded-full bg-muted-foreground/45" aria-hidden />;
}

/** Small factual chip — "Accusé requis", "Vu par 19 / 27". Never an action. */
export function MetaChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brick" | "success";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[0.6875rem] leading-4 font-semibold tracking-[0.01em] tabular-nums",
        tone === "brick" && "bg-brick/10 text-brick",
        tone === "success" && "bg-success/10 text-success",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
