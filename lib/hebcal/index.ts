import { flags, HDate, HebrewCalendar, Locale, Location } from "@hebcal/core";
import "@hebcal/locales";

import { addDays, type DateKey, dateFromKey, isoWeekday, keyFromDate } from "@/lib/calendar/dates";

/**
 * Jewish calendar for the agenda and the Shabbat / holiday mode (brief §7.5, §7.8, §10).
 * Everything is computed locally with @hebcal/core (no network) and cached per civil year.
 */
export type HebcalLocale = "fr" | "en";

export type GeoLocation = {
  latitude: number;
  longitude: number;
  timezone: string;
  name?: string;
};

/** École Abravanel, Neuilly-sur-Seine — overridden by `schools.latitude / longitude`. */
export const DEFAULT_LOCATION: GeoLocation = {
  latitude: 48.8847,
  longitude: 2.2686,
  timezone: "Europe/Paris",
  name: "Neuilly-sur-Seine",
};

export type HolidayCategory =
  | "major"
  | "minor"
  | "modern"
  | "fast"
  | "erev"
  | "cholHamoed"
  | "isruChag"
  | "roshChodesh"
  | "special";

export type JewishCalendarItem = {
  /** Local calendar date (YYYY-MM-DD). */
  date: DateKey;
  kind: "holiday" | "candles" | "havdalah" | "parasha";
  title: string;
  category?: HolidayCategory;
  /** Yom tov: no work, school typically closed. */
  yomTov: boolean;
  /** Local HH:mm for candle lighting / havdalah. */
  time?: string;
  /** ISO instant for timed items. */
  at?: string;
  url?: string;
};

export type JewishCalendarOptions = {
  /** Inclusive local date range. */
  from: DateKey;
  to: DateKey;
  location?: GeoLocation;
  locale?: HebcalLocale;
  candles?: boolean;
  parasha?: boolean;
  roshChodesh?: boolean;
  minorFasts?: boolean;
  modern?: boolean;
  specialShabbat?: boolean;
};

const yearCache = new Map<string, JewishCalendarItem[]>();

function toLocation(location: GeoLocation): Location {
  return new Location(
    location.latitude,
    location.longitude,
    false,
    location.timezone,
    location.name ?? "",
    "FR",
  );
}

function categorize(mask: number): { category: HolidayCategory; yomTov: boolean } {
  if (mask & flags.EREV) return { category: "erev", yomTov: false };
  if (mask & flags.CHOL_HAMOED) return { category: "cholHamoed", yomTov: false };
  if (mask & flags.CHAG) return { category: "major", yomTov: true };
  if (mask & (flags.MAJOR_FAST | flags.MINOR_FAST)) return { category: "fast", yomTov: false };
  if (mask & flags.ROSH_CHODESH) return { category: "roshChodesh", yomTov: false };
  if (mask & flags.MODERN_HOLIDAY) return { category: "modern", yomTov: false };
  if (mask & flags.SPECIAL_SHABBAT) return { category: "special", yomTov: false };
  return { category: "minor", yomTov: false };
}

const PARASHA_PREFIX = /^(Parachah|Parashat|Paracha|Parashah)\s+/i;

function computeYear(year: number, options: Required<Omit<JewishCalendarOptions, "from" | "to">>) {
  const events = HebrewCalendar.calendar({
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31),
    location: toLocation(options.location),
    candlelighting: options.candles,
    sedrot: options.parasha,
    il: false,
    locale: options.locale,
    noRoshChodesh: !options.roshChodesh,
    noMinorFast: !options.minorFasts,
    noModern: !options.modern,
    noSpecialShabbat: !options.specialShabbat,
    omer: false,
  });

  const items: JewishCalendarItem[] = [];
  for (const event of events) {
    const categories = event.getCategories();
    const date = keyFromDate(event.getDate().greg());
    const timed =
      "eventTime" in event && event.eventTime instanceof Date ? event.eventTime : undefined;
    const time = "eventTimeStr" in event ? String(event.eventTimeStr) : undefined;
    if (categories.includes("candles")) {
      items.push({
        date,
        kind: "candles",
        title: event.render(options.locale),
        yomTov: false,
        time,
        at: timed?.toISOString(),
      });
    } else if (categories.includes("havdalah")) {
      items.push({
        date,
        kind: "havdalah",
        title: event.render(options.locale),
        yomTov: false,
        time,
        at: timed?.toISOString(),
      });
    } else if (categories.includes("parashat")) {
      items.push({
        date,
        kind: "parasha",
        title: event.render(options.locale).replace(PARASHA_PREFIX, ""),
        yomTov: false,
        url: event.url(),
      });
    } else if (categories.includes("zmanim")) {
      continue; // fast begins / ends
    } else {
      const { category, yomTov } = categorize(event.getFlags());
      items.push({
        date,
        kind: "holiday",
        title: event.render(options.locale),
        category,
        yomTov,
        url: event.url(),
      });
    }
  }

  // "Lendemain de fête" (isru chag): the day after a yom tov that is not itself a holiday.
  const holidayDates = new Set(
    items.filter((i) => i.kind === "holiday" && i.category !== "roshChodesh").map((i) => i.date),
  );
  const yomTovs = items.filter((i) => i.yomTov);
  for (const day of yomTovs) {
    const next = addDays(day.date, 1);
    if (holidayDates.has(next)) continue;
    const base = events.find(
      (e) => keyFromDate(e.getDate().greg()) === day.date && e.getFlags() & flags.CHAG,
    );
    items.push({
      date: next,
      kind: "holiday",
      title: base ? Locale.gettext(base.basename(), options.locale) : day.title,
      category: "isruChag",
      yomTov: false,
    });
    holidayDates.add(next);
  }

  return items.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.at ?? "").localeCompare(b.at ?? ""),
  );
}

/** Holidays, candle-lighting times and parashiyot between `from` and `to` (inclusive). */
export function jewishCalendar(options: JewishCalendarOptions): JewishCalendarItem[] {
  const resolved = {
    location: options.location ?? DEFAULT_LOCATION,
    locale: options.locale ?? "fr",
    candles: options.candles ?? true,
    parasha: options.parasha ?? true,
    roshChodesh: options.roshChodesh ?? true,
    minorFasts: options.minorFasts ?? true,
    modern: options.modern ?? true,
    specialShabbat: options.specialShabbat ?? false,
  };
  const first = Number(options.from.slice(0, 4));
  const last = Number(options.to.slice(0, 4));
  const items: JewishCalendarItem[] = [];
  for (let year = first; year <= last; year++) {
    const key = [
      year,
      resolved.location.latitude,
      resolved.location.longitude,
      resolved.location.timezone,
      resolved.locale,
      resolved.candles,
      resolved.parasha,
      resolved.roshChodesh,
      resolved.minorFasts,
      resolved.modern,
      resolved.specialShabbat,
    ].join("|");
    let cached = yearCache.get(key);
    if (!cached) {
      cached = computeYear(year, resolved);
      yearCache.set(key, cached);
    }
    items.push(...cached);
  }
  return items.filter((i) => i.date >= options.from && i.date <= options.to);
}

/** "26 Eloul 5786" — the Hebrew date of a civil day. */
export function hebrewDate(date: DateKey, locale: HebcalLocale = "fr"): string {
  const hd = new HDate(dateFromKey(date));
  return `${hd.getDate()} ${Locale.gettext(hd.getMonthName(), locale)} ${hd.getFullYear()}`;
}

/** Name of the parasha read on the Shabbat on or after `date` (null on a yom tov Shabbat). */
export function parashaOfWeek(date: DateKey, locale: HebcalLocale = "fr"): string | null {
  const weekday = isoWeekday(date);
  const saturday = weekday === 6 ? date : addDays(date, 6 - weekday + (weekday === 7 ? 7 : 0));
  const items = jewishCalendar({
    from: saturday,
    to: saturday,
    locale,
    candles: false,
    roshChodesh: false,
    minorFasts: false,
    modern: false,
  });
  return items.find((i) => i.kind === "parasha")?.title ?? null;
}

export type QuietWindow = { start: string; end: string };

/**
 * Shabbat and yom tov windows during which push / e-mail delivery is paused (brief §7.8):
 * from candle lighting minus `marginMinutes` to havdalah plus `marginMinutes`.
 */
export function quietWindows(
  from: DateKey,
  to: DateKey,
  location: GeoLocation = DEFAULT_LOCATION,
  marginMinutes = 60,
): QuietWindow[] {
  const items = jewishCalendar({
    from: addDays(from, -3),
    to: addDays(to, 3),
    location,
    parasha: false,
    roshChodesh: false,
    minorFasts: false,
    modern: false,
  }).filter((i) => (i.kind === "candles" || i.kind === "havdalah") && i.at);
  const margin = marginMinutes * 60_000;
  const windows: QuietWindow[] = [];
  let open: number | null = null;
  for (const item of items) {
    const at = new Date(item.at!).getTime();
    if (item.kind === "candles") {
      if (open === null) open = at - margin;
    } else if (open !== null) {
      windows.push({
        start: new Date(open).toISOString(),
        end: new Date(at + margin).toISOString(),
      });
      open = null;
    }
  }
  const lower = new Date(dateFromKey(from)).getTime();
  const upper = new Date(dateFromKey(addDays(to, 1))).getTime();
  return windows.filter(
    (w) => new Date(w.end).getTime() >= lower && new Date(w.start).getTime() <= upper,
  );
}

export function isQuietTime(at: Date, location: GeoLocation = DEFAULT_LOCATION): boolean {
  const key = keyFromDate(at);
  return quietWindows(addDays(key, -1), addDays(key, 1), location).some(
    (w) => new Date(w.start) <= at && at <= new Date(w.end),
  );
}

/** Location of a school (falls back to Neuilly when coordinates are missing). */
export function locationFor(
  school: { latitude: number | null; longitude: number | null; timezone: string | null } | null,
): GeoLocation {
  if (!school || school.latitude === null || school.longitude === null) return DEFAULT_LOCATION;
  return {
    latitude: school.latitude,
    longitude: school.longitude,
    timezone: school.timezone ?? DEFAULT_LOCATION.timezone,
  };
}
