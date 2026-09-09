import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The one anatomy every piece of published content uses:
 * eyebrow · title · excerpt · media · footer, with at most one primary action.
 *
 * The same class post was previously rendered three different ways depending on
 * the page, and announcements had no component at all — their card was written
 * by hand inside the list, with the body either missing or printed in full.
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
  /** Something is waiting on the reader: a brick rule, used sparingly. */
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
    <h3 className="font-heading text-lg leading-snug font-normal tracking-tight text-balance sm:text-xl">
      {title}
    </h3>
  );

  return (
    <Card
      className={cn(
        "h-full",
        accent && "border-t-[3px] border-t-brick",
        muted && "border-dashed",
        className,
      )}
    >
      <CardHeader>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="eyebrow mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                {unread && <span className="size-2 shrink-0 rounded-full bg-brick" aria-hidden />}
                {eyebrow}
              </p>
            )}
            {href ? (
              <Link href={href} className="group/title block hover:underline">
                {heading}
              </Link>
            ) : (
              heading
            )}
          </div>
          {menu && <div className="shrink-0">{menu}</div>}
        </div>
      </CardHeader>
      {(excerpt || body || media) && (
        <CardContent className="flex flex-col gap-3">
          {excerpt && (
            <p className="prose-kesher line-clamp-3 text-[0.9375rem] text-pretty">{excerpt}</p>
          )}
          {body}
          {media}
        </CardContent>
      )}
      {footer && (
        <CardContent className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          {footer}
        </CardContent>
      )}
    </Card>
  );
}

/** Separator between eyebrow segments. */
export function EyebrowDot() {
  return <span className="size-1 rounded-full bg-border" aria-hidden />;
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
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "brick" && "bg-brick/10 text-brick",
        tone === "success" && "bg-success/12 text-success",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
