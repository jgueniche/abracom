import { type NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { addDays, localDateKey } from "@/lib/calendar/dates";
import { frenchPublicHolidaysBetween } from "@/lib/calendar/french-holidays";
import { buildIcs, type IcsEvent } from "@/lib/calendar/ics";
import { jewishCalendar, locationFor } from "@/lib/hebcal";
import { TIME_ZONE } from "@/lib/i18n/config";
import { appName } from "@/lib/env";
import { createAnonClient } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

/**
 * Private ICS feed (brief §7.5): the 48-hex token is the only credential, resolved by the
 * SQL functions `calendar_feed` / `calendar_feed_events` with the anonymous key.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) return new NextResponse(null, { status: 404 });

  const supabase = createAnonClient();
  const [{ data: feed }, { data: events }] = await Promise.all([
    supabase.rpc("calendar_feed", { feed_token: token }).maybeSingle(),
    supabase.rpc("calendar_feed_events", { feed_token: token }),
  ]);
  if (!feed) return new NextResponse(null, { status: 404 });

  const locale = feed.locale === "en" ? "en" : "fr";
  const t = await getTranslations({ locale, namespace: "agenda" });
  const timezone = feed.timezone ?? TIME_ZONE;
  const origin = request.nextUrl.origin;

  const icsEvents: IcsEvent[] = (events ?? []).map((e) => ({
    uid: `event-${e.id}@kesher`,
    title: e.waitlisted ? `[${t("rsvp.waitlistedBadge")}] ${e.title}` : e.title,
    description: e.description_md,
    location: e.location,
    url: `${origin}/agenda/${e.id}`,
    start: e.all_day ? localDateKey(e.starts_at, timezone) : e.starts_at,
    end: e.all_day ? (e.ends_at ? localDateKey(e.ends_at, timezone) : null) : e.ends_at,
    allDay: e.all_day,
    status: e.my_status === "maybe" || e.waitlisted ? "TENTATIVE" : "CONFIRMED",
    categories: [t(`kinds.${e.kind}`)],
    updatedAt: e.updated_at,
  }));

  if (feed.include_holidays) {
    const today = localDateKey(new Date(), timezone);
    const from = addDays(today, -60);
    const to = addDays(today, 400);
    const location = locationFor({
      latitude: feed.latitude,
      longitude: feed.longitude,
      timezone,
    });
    for (const item of jewishCalendar({
      from,
      to,
      location,
      locale,
      candles: false,
      parasha: false,
      roshChodesh: false,
      minorFasts: false,
      modern: true,
    })) {
      if (item.kind !== "holiday" || item.category === "isruChag") continue;
      icsEvents.push({
        uid: `jewish-${item.date}-${item.title.replace(/[^\p{L}\p{N}]+/gu, "-")}@kesher`,
        title: item.title,
        description: item.category ? t(`categories.${item.category}`) : null,
        url: item.url ?? null,
        start: item.date,
        allDay: true,
        categories: [t("filters.holidays")],
      });
    }
    for (const holiday of frenchPublicHolidaysBetween(from, to)) {
      icsEvents.push({
        uid: `public-${holiday.date}@kesher`,
        title: t(`publicHolidays.${holiday.key}`),
        start: holiday.date,
        allDay: true,
        categories: [t("publicHoliday")],
      });
    }
  }

  const ics = buildIcs({
    name: feed.school_name ? `${appName} · ${feed.school_name}` : appName,
    description: t("subtitle"),
    timezone,
    events: icsEvents,
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="kesher.ics"',
      "Cache-Control": "private, max-age=900",
    },
  });
}
