import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    let key = startKey < from ? from : startKey;
    const stop = endKey > last ? last : endKey;
    while (key <= stop) {
      dayOf(key).events.push({ event, continued: key !== startKey });
      key = addDays(key, 1);
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
    <>
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

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{t("today")}</p>
          <p className="font-heading text-lg font-semibold capitalize">
            {format.dateTime(noon(today), { dateStyle: "full" })}
          </p>
          <p className="text-sm">
            {hebrewDate(today, hebcalLocale)}
            {parasha ? ` · ${t("parashaOfWeek", { name: parasha })}` : ""}
          </p>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon" className="size-11">
            <Link href={link({ m: shiftMonth(month, -1) })} aria-label={t("previousMonth")}>
              <ChevronLeftIcon aria-hidden />
            </Link>
          </Button>
          <h2 className="min-w-44 text-center text-lg font-semibold capitalize">{monthLabel}</h2>
          <Button asChild variant="outline" size="icon" className="size-11">
            <Link href={link({ m: shiftMonth(month, 1) })} aria-label={t("nextMonth")}>
              <ChevronRightIcon aria-hidden />
            </Link>
          </Button>
        </div>
        <nav className="flex gap-2">
          {FILTERS.map((key) => (
            <Link
              key={key}
              href={link({ f: key })}
              aria-current={filter === key ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center rounded-full border px-4 text-sm font-medium",
                filter === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              {t(`filters.${key}`)}
            </Link>
          ))}
        </nav>
      </div>

      {keys.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-5">
          {keys.map((key) => {
            const day = days.get(key)!;
            const shabbat = isoWeekday(key) === 6;
            const holidays = day.jewish.filter((i) => i.kind === "holiday");
            const parashaItem = day.jewish.find((i) => i.kind === "parasha");
            const times = day.jewish.filter((i) => i.kind === "candles" || i.kind === "havdalah");
            return (
              <li
                key={key}
                className={cn(
                  "grid gap-2 sm:grid-cols-[8rem_1fr]",
                  key === today && "-m-2 rounded-2xl bg-primary/5 p-2",
                )}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 sm:flex-col sm:gap-0">
                  <p className="font-semibold capitalize">
                    {format.dateTime(noon(key), { weekday: "short", day: "numeric" })}
                  </p>
                  <p className="text-xs text-muted-foreground">{hebrewDate(key, hebcalLocale)}</p>
                  {shabbat && (
                    <Badge variant="outline" className="mt-1">
                      {t("shabbat")}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {(holidays.length > 0 ||
                    parashaItem ||
                    times.length > 0 ||
                    day.publicHolidays.length > 0) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {day.publicHolidays.map((name) => (
                        <Badge key={name} variant="outline">
                          {name} · {t("publicHoliday")}
                        </Badge>
                      ))}
                      {holidays.map((item) => (
                        <Badge
                          key={`${item.category}-${item.title}`}
                          variant={item.yomTov ? "default" : "secondary"}
                          title={item.category ? t(`categories.${item.category}`) : undefined}
                        >
                          {item.category === "isruChag"
                            ? t("isruChagTitle", { name: item.title })
                            : item.title}
                        </Badge>
                      ))}
                      {parashaItem && (
                        <Badge variant="outline">{t("parasha", { name: parashaItem.title })}</Badge>
                      )}
                      {times.map((item) => (
                        <span key={item.kind} className="text-xs text-muted-foreground">
                          {item.kind === "candles"
                            ? t("candles", { time: item.time ?? "" })
                            : t("havdalah", { time: item.time ?? "" })}
                        </span>
                      ))}
                    </div>
                  )}
                  {day.events.map(({ event, continued }) => (
                    <EventCard key={event.id} event={event} continued={continued} />
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-8">
        <CalendarFeedCard feed={feed} origin={`${protocol}://${host}`} />
      </div>
    </>
  );
}
