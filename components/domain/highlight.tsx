import type { ReactNode } from "react";

/**
 * Query words marked inside a passage, from character ranges rather than from
 * a string of HTML — no `dangerouslySetInnerHTML`, nothing to escape.
 *
 * Shared by the help search (in the browser) and the global search (on the
 * server), so both highlight the same way.
 */
export function Highlighted({ text, ranges }: { text: string; ranges: [number, number][] }) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [from, to] of ranges) {
    if (from > cursor) parts.push(text.slice(cursor, from));
    parts.push(
      <mark key={from} className="rounded bg-secondary/60 px-0.5 text-foreground">
        {text.slice(from, to)}
      </mark>,
    );
    cursor = to;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
