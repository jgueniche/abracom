import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A list of one-line entries — the densest, quietest way to show a run of
 * things that are alike, and the right answer wherever a card grid was doing
 * the job of a table.
 *
 * The plane is closed by a single hairline; inside it the rows are separated by
 * the lighter `--rule`, so the list reads as one object and not as a stack of
 * boxes. Nine screens had each written their own version of this, with three
 * different row heights and as many shades of separator.
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
    <ul
      aria-labelledby={labelledBy}
      className={cn(
        "divide-y divide-rule overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      {children}
    </ul>
  );
}

export function Row({
  href,
  /** Small muted word before the title — the kind of thing this row is. */
  kind,
  title,
  detail,
  trailing,
  /** Something here is waiting on the reader: a dot in the margin. */
  urgent = false,
  className,
}: {
  href?: string;
  kind?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
  urgent?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">
          {kind && <span className="text-muted-foreground">{kind} · </span>}
          <span className="font-medium">{title}</span>
        </span>
        {detail && <span className="meta truncate">{detail}</span>}
      </span>
      {trailing}
      {href && (
        <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
      )}
    </>
  );

  const inner = "flex min-h-12 items-center gap-2.5 px-3.5 py-2.5";

  return (
    // What waits on the reader is marked by a bar at the edge of the row —
    // the way a change is marked in a margin — rather than by a coloured glyph
    // repeating, in a picture, the word already written on the line. Inside the
    // plane, because the plane clips what leaves it.
    <li className={cn("relative", className)}>
      {urgent && <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-brick" />}
      {href ? (
        <Link href={href} className={cn(inner, "transition-colors hover:bg-muted/70")}>
          {body}
        </Link>
      ) : (
        <div className={inner}>{body}</div>
      )}
    </li>
  );
}
