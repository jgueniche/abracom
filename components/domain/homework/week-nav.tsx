import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";

/**
 * Previous week · the week's dates · next week, on one line.
 *
 * The three buttons used to sit in the page header beside « Nouveau devoir », where on a phone
 * they wrapped: the next-week arrow ended alone on a second line. They belong to the week, so
 * they now sit on top of it, with a way back to the week being prepared when the reader has
 * wandered off it.
 */
export async function WeekNav({
  label,
  previous,
  next,
  current,
  views,
}: {
  label: string;
  previous: string;
  next: string;
  /** Where the week being prepared is, when it is not this one. */
  current: string | null;
  /** « Jour » / « Semaine » (ADR-0083): where each view is, and which one is shown. */
  views?: { day: string; week: string; current: "day" | "week" };
}) {
  const t = await getTranslations("diary");
  // One row (ADR-0080): the week named on the left, the two arrows together on the right. It was
  // a row of its own with the label centred between two far-apart arrows, above a strip and a bar.
  return (
    <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      <div className="flex min-w-0 basis-full flex-wrap items-baseline gap-x-3 sm:flex-1 sm:basis-auto">
        <p className="text-sm font-semibold tabular-nums first-letter:uppercase">{label}</p>
        {current && (
          <Link
            href={current}
            className="inline-flex min-h-8 items-center text-xs font-medium text-primary underline decoration-primary/30 underline-offset-[3px] hover:decoration-primary"
          >
            {t("backToCurrentWeek")}
          </Link>
        )}
      </div>
      {views && (
        <nav
          aria-label={t("viewLabel")}
          className="mr-auto flex shrink-0 rounded-lg bg-muted p-0.5 text-[0.8125rem] font-medium sm:mr-1"
        >
          {(["day", "week"] as const).map((view) => (
            <Link
              key={view}
              href={views[view]}
              prefetch={false}
              scroll={false}
              aria-current={views.current === view ? "page" : undefined}
              className={cn(
                "relative inline-flex min-h-8 items-center rounded-md px-3 transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
                views.current === view
                  ? "bg-background font-semibold text-foreground shadow-xs"
                  : "text-foreground/70 hover:text-foreground",
              )}
            >
              {t(view === "day" ? "viewDay" : "viewWeek")}
            </Link>
          ))}
        </nav>
      )}
      <Button asChild variant="ghost" size="icon" className="size-11 shrink-0">
        <Link href={previous} aria-label={t("previousWeek")}>
          <ChevronLeftIcon aria-hidden className="size-5" />
        </Link>
      </Button>
      <Button asChild variant="ghost" size="icon" className="-ml-2 size-11 shrink-0">
        <Link href={next} aria-label={t("nextWeek")}>
          <ChevronRightIcon aria-hidden className="size-5" />
        </Link>
      </Button>
    </div>
  );
}
