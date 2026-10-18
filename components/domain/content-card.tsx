import { Link } from "@/components/ui/link";
import type { ReactNode } from "react";

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
 *
 * The title sits at 15 px, under the 15 px of a tab and the 13 px caps of a
 * section label rather than half again above them: the structure of a screen
 * has to be louder than the things it holds, and the first pass at this had it
 * exactly the other way round.
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
  /** Something is waiting on the reader: a brick bar in the margin. */
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
    <h3
      className={cn(
        "font-heading text-base leading-snug font-normal tracking-[-0.006em] text-balance",
        // a draft steps back by its colour, never by opacity: faded metadata fell under 4.5:1
        muted && "text-muted-foreground",
      )}
    >
      {title}
    </h3>
  );

  // An entry, not a card (ADR-0078): the cahier de vie was a column of bordered,
  // rounded, shadowed panels, each cut by a footer rule — a wall of frames around
  // what is, in the end, a diary. It now reads as one: a dateline, a title in
  // the school's voice, the text, the photographs, who wrote it; and the white
  // space the list puts between two entries.
  return (
    <article className={cn("relative flex flex-col gap-2", className)}>
      {accent && (
        <span aria-hidden className="absolute inset-y-1 -left-3 w-[2px] rounded-full bg-brick" />
      )}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="eyebrow mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {unread && <span className="size-1.5 shrink-0 rounded-full bg-brick" aria-hidden />}
              {eyebrow}
            </p>
          )}
          {href ? (
            <Link
              href={href}
              prefetch={false}
              className="block hover:underline hover:decoration-foreground/25 hover:underline-offset-[3px]"
            >
              {heading}
            </Link>
          ) : (
            heading
          )}
        </div>
        {menu && <div className="-mt-1 shrink-0">{menu}</div>}
      </div>
      {excerpt && (
        <p className="line-clamp-2 text-sm leading-[1.55] text-pretty text-muted-foreground">
          {excerpt}
        </p>
      )}
      {body}
      {media}
      {footer && <div className="flex flex-wrap items-center gap-1.5">{footer}</div>}
    </article>
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
