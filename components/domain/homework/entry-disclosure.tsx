"use client";

import { ChevronDownIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A homework of the diary, folded to its two lines and unfolded in place (session 38).
 *
 * It used to be a `<details>`: the instruction jumped open at once, the line above switched from
 * clipped to wrapped in the same frame, and the only thing that told it could open was a 14 px
 * chevron. The porteur found it ugly and not worth much — and the page that prints the homework
 * and offers « S'entraîner » was reached only by knowing that the title was a link.
 *
 * Now the whole two-line summary is one button, 44 px at least, inside the heading — the
 * accordion pattern of WAI-ARIA, so that the title stays a heading and the state is announced. The panel grows from its own
 * height with a fade (`grid-template-rows` 0fr → 1fr), quicker to close than to open, and not at
 * all when the reader asked the system for less motion. Folded, the panel is `inert`: nothing in
 * it can be reached by the keyboard or read out. The homework the reader came back from (the
 * address ends with `#devoir-<id>`) opens by itself.
 */
export function EntryDisclosure({
  entryId,
  summary,
  children,
}: {
  entryId: string;
  /** The two lines, title then what it is — phrasing content only: it sits in a button. */
  summary: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (window.location.hash === `#devoir-${entryId}`) setOpen(true);
  }, [entryId]);

  return (
    <div className="min-w-0 flex-1">
      <h3 className="font-sans text-base font-normal tracking-normal">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="group/toggle -mx-1.5 -my-1 flex min-h-11 w-[calc(100%+0.75rem)] cursor-pointer touch-manipulation items-start gap-2 rounded-md px-1.5 py-1 text-left transition-colors duration-150 hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:bg-muted"
        >
          <span className="min-w-0 flex-1">{summary}</span>
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </button>
      </h3>
      <div
        id={panelId}
        inert={!open}
        className={cn(
          "grid motion-reduce:transition-none",
          open
            ? "grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] duration-[220ms] ease-out"
            : "grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-150 ease-in",
        )}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
