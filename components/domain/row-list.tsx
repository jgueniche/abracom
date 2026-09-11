import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";

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
  icon: Icon,
  /** Small muted word before the title — the kind of thing this row is. */
  kind,
  title,
  detail,
  trailing,
  /** Something here is waiting on the reader; the icon takes the brick. */
  urgent = false,
  className,
}: {
  href?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  kind?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
  urgent?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {Icon && (
        <Icon
          className={cn("size-4 shrink-0", urgent ? "text-brick" : "text-muted-foreground")}
          aria-hidden
        />
      )}
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

  const inner = "flex min-h-12 items-center gap-2.5 px-3.5 py-2";

  return (
    <li className={className}>
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
