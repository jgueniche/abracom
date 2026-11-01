import { getTranslations } from "next-intl/server";

import { Link } from "@/components/ui/link";

import { DiaryViewToggle, WeekArrows } from "./selection";

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
  /**
   * « Jour » / « Semaine » (ADR-0083): where each view is, for a new tab. Which one is shown is
   * read from the address, and switching asks the server nothing (ADR-0086).
   */
  views?: { day: string; week: string };
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
        <DiaryViewToggle
          label={t("viewLabel")}
          labels={{ day: t("viewDay"), week: t("viewWeek") }}
          hrefs={views}
        />
      )}
      <WeekArrows
        previous={previous}
        next={next}
        labels={{ previous: t("previousWeek"), next: t("nextWeek") }}
      />
    </div>
  );
}
