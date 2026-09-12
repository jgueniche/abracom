import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * An index: a run of things you scan in order, set as an index and not as a
 * grid of cards.
 *
 * The announcements — the first product objective — were nine boxes in two
 * columns of 950 px. Each box held two lines of text, each was a different
 * height because its neighbour had a footer, and the date sat a hand's width
 * from the title it dated. A list of circulars is a list: a dateline, a title,
 * a line of summary, a rule, the next one. It reads faster, it holds a month of
 * announcements in the space the grid gave to four, and it is what the content
 * has always been.
 *
 * What is waiting on the reader is marked in the margin — a dot outside the
 * text block, the way a passage is marked in a book — rather than by repainting
 * the entry.
 */
export function IndexList({
  children,
  className,
  "aria-labelledby": labelledBy,
}: {
  children: ReactNode;
  className?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <ul aria-labelledby={labelledBy} className={cn("border-t border-rule", className)}>
      {children}
    </ul>
  );
}

export function IndexEntry({
  href,
  eyebrow,
  title,
  excerpt,
  /** Right end of the dateline: a fact, never an action. */
  marker,
  /** Something is waiting on the reader: a dot in the margin. */
  accent = false,
  /** Not yet opened: the title carries the weight instead of a coloured pill. */
  unread = false,
  children,
  className,
}: {
  href: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  excerpt?: string;
  marker?: ReactNode;
  accent?: boolean;
  unread?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <li className={cn("relative border-b border-rule", className)}>
      {accent && (
        <span
          aria-hidden
          className="absolute inset-y-2 -left-3 w-[2px] rounded-full bg-brick sm:-left-4"
        />
      )}
      <Link
        href={href}
        className="-mx-3 block rounded-md px-3 py-3.5 transition-colors hover:bg-muted/50"
      >
        {eyebrow && (
          <p className="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">{eyebrow}</span>
            {marker && <span className="ml-auto shrink-0">{marker}</span>}
          </p>
        )}
        <h3
          className={cn(
            "mt-1 font-heading text-base leading-snug tracking-[-0.006em] text-pretty",
            unread ? "font-medium" : "font-normal",
          )}
        >
          {title}
        </h3>
        {excerpt && (
          <p className="mt-0.5 line-clamp-1 text-[0.8125rem] text-muted-foreground">{excerpt}</p>
        )}
        {children}
      </Link>
    </li>
  );
}
