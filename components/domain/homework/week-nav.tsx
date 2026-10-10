import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";

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
}: {
  label: string;
  previous: string;
  next: string;
  /** Where the week being prepared is, when it is not this one. */
  current: string | null;
}) {
  const t = await getTranslations("diary");
  return (
    <div className="mb-1 flex items-center gap-2">
      <Button asChild variant="ghost" size="icon" className="size-11 shrink-0">
        <Link href={previous} aria-label={t("previousWeek")}>
          <ChevronLeftIcon aria-hidden className="size-5" />
        </Link>
      </Button>
      <div className="flex min-w-0 flex-1 flex-col items-center">
        <p className="text-[0.9375rem] font-semibold tabular-nums first-letter:uppercase">
          {label}
        </p>
        {current && (
          <Link
            href={current}
            className="inline-flex min-h-8 items-center text-xs font-medium text-primary underline decoration-primary/30 underline-offset-[3px] hover:decoration-primary"
          >
            {t("backToCurrentWeek")}
          </Link>
        )}
      </div>
      <Button asChild variant="ghost" size="icon" className="size-11 shrink-0">
        <Link href={next} aria-label={t("nextWeek")}>
          <ChevronRightIcon aria-hidden className="size-5" />
        </Link>
      </Button>
    </div>
  );
}
