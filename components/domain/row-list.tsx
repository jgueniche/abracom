import { Link } from "@/components/ui/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A list of short entries — the densest, quietest way to show a run of things
 * that are alike, and the right answer wherever a card grid was doing the job
 * of a table.
 *
 * It used to be a bordered plane cut by a rule under every row, set under a
 * section label that drew its own rule: three lines before the first word, and
 * a home screen that read as boxes in boxes (ADR-0078). It is now laid out the
 * way the Messages tab lays out its conversations, the one screen the porteur
 * held up as clear: no frame, no rule, a few pixels between the rows, a regular
 * left edge, and the row itself appearing under the pointer.
 */
export function RowList({
  children,
  className,
  "aria-labelledby": labelledBy,
}: {
  children: ReactNode;
  className?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <ul aria-labelledby={labelledBy} className={cn("flex flex-col gap-0.5", className)}>
      {children}
    </ul>
  );
}

export function Row({
  href,
  /** What kind of thing this row is — set small above the title, never before it on one line. */
  kind,
  title,
  detail,
  /** The left anchor, as the avatar is in Messages: an avatar, a date, a mark. */
  leading,
  trailing,
  /** Something here is waiting on the reader: the kind in brick, and a bar in the margin. */
  urgent = false,
  className,
}: {
  href?: string;
  kind?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  urgent?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {leading}
      {/* Two lines rather than one cut short: « À confirmer · Réunion de rentrée des classe… »
          lost the end of every title on a phone. */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {kind && <span className={cn("eyebrow", urgent && "text-brick")}>{kind}</span>}
        <span className="line-clamp-2 text-sm leading-snug font-medium text-pretty">{title}</span>
        {detail && <span className="meta line-clamp-1">{detail}</span>}
      </span>
      {trailing && <span className="shrink-0 self-start pt-px">{trailing}</span>}
    </>
  );

  const inner = "-mx-3 flex min-h-12 items-start gap-3 rounded-lg px-3 py-2.5";

  return (
    <li className={cn("relative", className)}>
      {/* What waits on the reader is marked in the margin, the way a change is marked in a book. */}
      {urgent && (
        <span aria-hidden className="absolute inset-y-3 -left-3 w-[2px] rounded-full bg-brick" />
      )}
      {href ? (
        // A list is read, then one row is chosen: prefetching all of them costs
        // one server render per row for the rows nobody opens (ADR-0061).
        <Link
          href={href}
          prefetch={false}
          className={cn(inner, "transition-colors hover:bg-muted focus-visible:bg-muted")}
        >
          {body}
        </Link>
      ) : (
        <div className={inner}>{body}</div>
      )}
    </li>
  );
}
