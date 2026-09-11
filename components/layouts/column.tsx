import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The measure of a screen.
 *
 * Session 16 lifted the page cap from 1024 px to 1760 px because half of a
 * large display was painted with nothing — and drew the wrong conclusion from
 * a correct observation. Every screen then used the whole 1760 px, so a list of
 * circulars ran its titles across a metre of glass with the date a hand's width
 * from the title it dates, and a hub of five links spread over two rows and
 * left a thousand pixels of empty page underneath.
 *
 * Width is not a global setting, it is a property of the *kind* of screen:
 *
 * - `text` — something a person reads from beginning to end (a circular, a help
 *   article, a note home). Around 42 rem, the width at which a line of text
 *   stays comfortably readable.
 * - `index` — a list you scan (announcements, documents, homework, a hub).
 *   Wide enough for a title, a date and a marker on one line; narrow enough
 *   that they stay related to each other.
 * - `full` — a console: a table with ten columns, a month grid, two panes of
 *   messaging, an attendance board. Here the glass is the point.
 *
 * A column is aligned to the page's left margin, not centred: an interface has
 * a left edge that the eye returns to — the navigation, the titles, the rules
 * all start there — and a block of text floating in the middle of the window
 * breaks that line for no gain.
 */
const WIDTHS = {
  text: "max-w-[42rem]",
  index: "max-w-[58rem]",
  full: "max-w-none",
} as const;

export function Column({
  width = "index",
  /**
   * Secondary matter that belongs beside the column rather than under it —
   * the next events, the attachments of a circular, the state of a request.
   * It becomes a fixed rail from `xl`, and falls under the column before that.
   */
  rail,
  children,
  className,
}: {
  width?: keyof typeof WIDTHS;
  rail?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  if (!rail) return <div className={cn(WIDTHS[width], className)}>{children}</div>;

  return (
    <div
      className={cn(
        "grid items-start gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,var(--col))_18rem]",
        width === "text" ? "[--col:42rem]" : "[--col:58rem]",
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
      <aside className="min-w-0 xl:sticky xl:top-24">{rail}</aside>
    </div>
  );
}
