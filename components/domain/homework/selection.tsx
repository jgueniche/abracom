"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, type MouseEvent, type ReactNode, useEffect } from "react";

import { FilterChip, FilterChips } from "@/components/domain/filter-chip";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";

/**
 * Moving between the days of a week, on the spot (ADR-0086).
 *
 * The diary fetches the whole week — Monday to Sunday — to draw the strip; touching a day used
 * to navigate to `?jour=…` all the same, and the server read the same week again, with the
 * session check, the children, the classes, the signed links of the pages: half a second on
 * the free database for a day that was already on the page. The day and the view now live in
 * the address, changed in place (`history.replaceState`, which Next reads back through
 * `useSearchParams`): a reload, a shared link or the back button land where they did, and the
 * server is not asked. The links keep their `href`, for a new tab or a page without script.
 */
export type DiaryView = "day" | "week";

/** The day and the view the diary shows: the address's, or the server's choice. */
export function useDiarySelection(defaultDay: string | null, days: readonly string[]) {
  const params = useSearchParams();
  const asked = params.get("jour");
  return {
    day: asked && days.includes(asked) ? asked : defaultDay,
    view: (params.get("vue") === "semaine" ? "week" : "day") as DiaryView,
  };
}

function select(next: { day?: string; view?: DiaryView }) {
  const url = new URL(window.location.href);
  if (next.day) {
    // A day carries its week with it.
    url.searchParams.set("jour", next.day);
    url.searchParams.delete("semaine");
  }
  if (next.view === "week") url.searchParams.set("vue", "semaine");
  if (next.view === "day") url.searchParams.delete("vue");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

/** A plain click — not a new tab, not a download: the page handles it itself. */
function handled(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return false;
  event.preventDefault();
  return true;
}

export function useSelectDay() {
  return (day: string) => (event: MouseEvent) => {
    if (handled(event)) select({ day, view: "day" });
  };
}

/** The days, already rendered by the server, shown one at a time or stacked. */
export function DiaryPanels({
  defaultDay,
  days,
  panels,
  upcoming,
  earlier,
  earlierLabel,
}: {
  defaultDay: string | null;
  days: string[];
  panels: Record<string, ReactNode>;
  /** The week view: the day being prepared and the days after it that hold something. */
  upcoming: string[];
  /** …and, folded under them, the days already handed in. */
  earlier: string[];
  earlierLabel: string;
}) {
  const { day, view } = useDiarySelection(defaultDay, days);
  if (view === "day" && day) return <>{panels[day]}</>;
  return (
    <div className="flex flex-col gap-7">
      {upcoming.map((key) => (
        <Fragment key={key}>{panels[key]}</Fragment>
      ))}
      {earlier.length > 0 && (
        <div className="flex flex-col gap-5">
          <p className="eyebrow pt-3">{earlierLabel}</p>
          {earlier.map((key) => (
            <Fragment key={key}>{panels[key]}</Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/** « Jour » / « Semaine » (ADR-0083), switched in place. */
export function DiaryViewToggle({
  label,
  labels,
  hrefs,
}: {
  label: string;
  labels: Record<DiaryView, string>;
  /** Where each view is, for a new tab or a page without script. */
  hrefs: Record<DiaryView, string>;
}) {
  const params = useSearchParams();
  const current: DiaryView = params.get("vue") === "semaine" ? "week" : "day";
  return (
    <nav
      aria-label={label}
      className="mr-auto flex shrink-0 rounded-lg bg-muted p-0.5 text-[0.8125rem] font-medium sm:mr-1"
    >
      {(["day", "week"] as const).map((view) => (
        <Link
          key={view}
          href={hrefs[view]}
          scroll={false}
          onClick={(event) => {
            if (handled(event)) select({ view });
          }}
          aria-current={current === view ? "page" : undefined}
          className={cn(
            "relative inline-flex min-h-8 items-center rounded-md px-3 transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
            current === view
              ? "bg-background font-semibold text-foreground shadow-xs"
              : "text-foreground/70 hover:text-foreground",
          )}
        >
          {labels[view]}
        </Link>
      ))}
    </nav>
  );
}

/** The view the reader chose, carried to another week or another child. */
function withView(href: string, view: DiaryView) {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  if (view === "week") params.set("vue", "semaine");
  else params.delete("vue");
  const next = params.toString();
  return next ? `${path}?${next}` : path!;
}

/**
 * The previous and the next week. A week is a page of its own, so these do go to the server —
 * but both are loaded, data included, a moment after the diary shows, so the arrow answers from
 * the router's cache like a day does.
 */
export function WeekArrows({
  previous,
  next,
  labels,
}: {
  previous: string;
  next: string;
  labels: { previous: string; next: string };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const view: DiaryView = params.get("vue") === "semaine" ? "week" : "day";
  const before = withView(previous, view);
  const after = withView(next, view);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.prefetch(after);
      router.prefetch(before);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [router, before, after]);

  return (
    <>
      <Button asChild variant="ghost" size="icon" className="size-11 shrink-0">
        <Link href={before} aria-label={labels.previous}>
          <ChevronLeftIcon aria-hidden className="size-5" />
        </Link>
      </Button>
      <Button asChild variant="ghost" size="icon" className="-ml-2 size-11 shrink-0">
        <Link href={after} aria-label={labels.next}>
          <ChevronRightIcon aria-hidden className="size-5" />
        </Link>
      </Button>
    </>
  );
}

/**
 * The children filter of the diary: it keeps the day and the view being read, which the server
 * could not know once they were changed in place.
 */
export function DiaryChildFilter({
  options,
  selected,
  defaultDay,
  days,
  label,
  className,
}: {
  options: Array<{ id: string | null; name: string }>;
  selected: string | null;
  defaultDay: string | null;
  days: string[];
  label: string;
  className?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { day, view } = useDiarySelection(defaultDay, days);
  const hrefFor = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("enfant", id);
    else next.delete("enfant");
    if (view === "day" && day) {
      next.set("jour", day);
      next.delete("semaine");
    }
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
  return (
    <FilterChips label={label} className={className}>
      {options.map((option) => (
        <FilterChip
          key={option.id ?? "all"}
          href={hrefFor(option.id)}
          active={selected === option.id}
        >
          {option.name}
        </FilterChip>
      ))}
    </FilterChips>
  );
}
