import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { FilterChip, FilterChips } from "@/components/domain/filter-chip";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Link } from "@/components/ui/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  addDays,
  type DateKey,
  isoWeekday,
  localDateKey,
  monthRange,
  shiftMonth,
  zonedToUtc,
} from "@/lib/calendar/dates";
import { frenchPublicHolidaysBetween } from "@/lib/calendar/french-holidays";
import {
  hebrewDate,
  jewishCalendar,
  type JewishCalendarItem,
  locationFor,
  parashaOfWeek,
} from "@/lib/hebcal";
import { TIME_ZONE } from "@/lib/i18n/config";
import { hasSchoolRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { type AgendaEvent, getAgendaEvents, getMyCalendarFeed } from "@/server/queries/agenda";

import { CalendarFeedCard } from "./_components/calendar-feed-card";
import { EventCard } from "./_components/event-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("agenda");
  return { title: t("title") };
}

type Filter = "all" | "events" | "holidays";
const FILTERS: Filter[] = ["all", "events", "holidays"];

type Day = {
  events: Array<{ event: AgendaEvent; continued: boolean }>;
  jewish: JewishCalendarItem[];
  publicHolidays: string[];
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; f?: string }>;
}) {
  const user = await requireCurrentUser();
  const { m, f } = await searchParams;
  const [t, format, locale, feed, requestHeaders] = await Promise.all([
    getTranslations("agenda"),
    getFormatter(),
    getLocale(),
    getMyCalendarFeed(),
    headers(),
  ]);
  const hebcalLocale = locale === "en" ? "en" : "fr";
  const timezone = user.school?.timezone ?? TIME_ZONE;
  const location = locationFor(user.school);
  const today = localDateKey(new Date(), timezone);
  const month = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : today.slice(0, 7);
  const filter: Filter = f === "events" || f === "holidays" ? f : "all";
  const { from, to } = monthRange(month);
  const last = addDays(to, -1);

  const events = await getAgendaEvents(
    user.id,
    zonedToUtc(from, timezone).toISOString(),
    zonedToUtc(to, timezone).toISOString(),
  );
  const jewish =
    filter === "events" ? [] : jewishCalendar({ from, to: last, location, locale: hebcalLocale });
  const publicHolidays = filter === "events" ? [] : frenchPublicHolidaysBetween(from, to);
  const canEdit =
    user.school !== null &&
    hasSchoolRole(user.roles, user.school.id, ["school_admin", "staff", "teacher"]);

  const days = new Map<DateKey, Day>();
  const dayOf = (key: DateKey): Day => {
    let day = days.get(key);
    if (!day) {
      day = { events: [], jewish: [], publicHolidays: [] };
      days.set(key, day);
    }
    return day;
  };
  for (const event of events) {
    if (filter === "holidays" && event.kind !== "holiday") continue;
    const startKey = localDateKey(event.starts_at, timezone);
    const endKey =
      event.all_day && event.ends_at ? localDateKey(event.ends_at, timezone) : startKey;
    // A run of days is named once, on its first day of the month, with its dates: the holidays
    // used to fill fifteen days in a row with « Vacances de la Toussaint (suite) » (ADR-0078).
    const first = startKey < from ? from : startKey;
    if (first <= (endKey > last ? last : endKey)) {
      dayOf(first).events.push({ event, continued: first !== startKey });
    }
  }
  for (const item of jewish) dayOf(item.date).jewish.push(item);
  for (const holiday of publicHolidays) {
    dayOf(holiday.date).publicHolidays.push(t(`publicHolidays.${holiday.key}`));
  }
  const keys = [...days.keys()].sort();

  const noon = (key: DateKey) => new Date(`${key}T12:00:00Z`);
  const monthLabel = format.dateTime(noon(from), { month: "long", year: "numeric" });
  const parasha = parashaOfWeek(today, hebcalLocale);
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const link = (next: { m?: string; f?: Filter }) => {
    const target = next.f ?? filter;
    return `/agenda?m=${next.m ?? month}${target !== "all" ? `&f=${target}` : ""}`;
  };

  return (
    <Column>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canEdit ? (
            <Button asChild className="min-h-11">
              <Link href="/agenda/nouveau">
                <PlusIcon aria-hidden />
                {t("new")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Today's date is a dateline, not a banner: three lines in a box across
          the top of the page announced the day the reader is already living. */}
      <p className="mb-5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="eyebrow">{t("today")}</span>
        <span className="font-heading text-base capitalize">
          {format.dateTime(noon(today), { dateStyle: "full" })}
        </span>
        <span className="meta">
          {hebrewDate(today, hebcalLocale)}
          {parasha ? ` · ${t("parashaOfWeek", { name: parasha })}` : ""}
        </span>
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="size-11">
            <Link href={link({ m: shiftMonth(month, -1) })} aria-label={t("previousMonth")}>
              <ChevronLeftIcon aria-hidden />
            </Link>
          </Button>
          <h2 className="min-w-36 text-center text-base font-semibold capitalize">{monthLabel}</h2>
          <Button asChild variant="ghost" size="icon" className="size-11">
            <Link href={link({ m: shiftMonth(month, 1) })} aria-label={t("nextMonth")}>
              <ChevronRightIcon aria-hidden />
            </Link>
          </Button>
        </div>
        <FilterChips className="-mx-0 mb-0 px-0">
          {FILTERS.map((key) => (
            <FilterChip key={key} href={link({ f: key })} active={filter === key}>
              {t(`filters.${key}`)}
            </FilterChip>
          ))}
        </FilterChips>
      </div>

      {keys.length === 0 ? (
        <EmptyState
          icon={CalendarDaysIcon}
          title={t("empty")}
          description={t("emptyHint")}
          action={canEdit ? { href: "/agenda/nouveau", label: t("new") } : undefined}
        />
      ) : (
        <ol className="flex flex-col">
          {keys.map((key) => {
            const day = days.get(key)!;
            const shabbat = isoWeekday(key) === 6;
            const holidays = day.jewish.filter((i) => i.kind === "holiday");
            const parashaItem = day.jewish.find((i) => i.kind === "parasha");
            const times = day.jewish.filter((i) => i.kind === "candles" || i.kind === "havdalah");
            return (
              <li
                key={key}
                // The day is the unit of this list, and its date the left edge every line of it
                // hangs from — the hours of the timetable, the avatar of Messages. On a phone the
                // date used to run across the top of the day, with the Hebrew date, « Chabbat »
                // and the times each on a line of their own: four days to a screen (ADR-0080).
                className="relative grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 py-2 sm:grid-cols-[4rem_minmax(0,1fr)]"
              >
                {key === today && (
                  <span
                    aria-hidden
                    className="absolute inset-y-2 -left-3 w-[2px] rounded-full bg-primary"
                  />
                )}
                <div className="flex flex-col items-center pt-0.5 leading-none">
                  <span
                    className={cn(
                      "font-heading text-xl leading-none tabular-nums",
                      key === today && "text-primary",
                    )}
                  >
                    {format.dateTime(noon(key), { day: "numeric" })}
                  </span>
                  <span className={cn("eyebrow mt-1", key === today && "text-primary")}>
                    {format.dateTime(noon(key), { weekday: "short" }).replace(".", "")}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  {/* The calendar of the day in one quiet run: Hebrew date, Shabbat, the week's
                      parasha, the times; a yom tov keeps its colour and weight. */}
                  <p className="meta flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-0.5">
                    <span>{hebrewDate(key, hebcalLocale)}</span>
                    {shabbat && (
                      <span className="font-semibold text-foreground/80">{t("shabbat")}</span>
                    )}
                    {day.publicHolidays.map((name) => (
                      <span key={name} className="font-semibold text-foreground/80">
                        {name} · {t("publicHoliday")}
                      </span>
                    ))}
                    {holidays.map((item) => (
                      <span
                        key={`${item.category}-${item.title}`}
                        title={item.category ? t(`categories.${item.category}`) : undefined}
                        className={cn(item.yomTov ? "font-semibold text-primary" : "font-medium")}
                      >
                        {item.category === "isruChag"
                          ? t("isruChagTitle", { name: item.title })
                          : item.title}
                      </span>
                    ))}
                    {parashaItem && (
                      <span className="italic">{t("parasha", { name: parashaItem.title })}</span>
                    )}
                    {times.map((item) => (
                      <span key={item.kind}>
                        {item.kind === "candles"
                          ? t("candles", { time: item.time ?? "" })
                          : t("havdalah", { time: item.time ?? "" })}
                      </span>
                    ))}
                  </p>
                  {day.events.length > 0 && (
                    <ul className="flex flex-col">
                      {day.events.map(({ event, continued }) => (
                        <li key={event.id}>
                          <EventCard event={event} continued={continued} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-8">
        <CalendarFeedCard feed={feed} origin={`${protocol}://${host}`} />
      </div>
    </Column>
  );
}
