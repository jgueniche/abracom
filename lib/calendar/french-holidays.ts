import { addDays, type DateKey } from "./dates";

/** Keys are translated in the UI (`agenda.publicHolidays.*`). */
export type PublicHolidayKey =
  | "newYear"
  | "easterMonday"
  | "labourDay"
  | "victoryDay"
  | "ascension"
  | "whitMonday"
  | "bastilleDay"
  | "assumption"
  | "allSaints"
  | "armistice"
  | "christmas";

export type PublicHoliday = { date: DateKey; key: PublicHolidayKey };

/** Gregorian Easter Sunday (Meeus / Jones / Butcher). */
export function easterSunday(year: number): DateKey {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The eleven French public holidays (metropolitan France) of a civil year. */
export function frenchPublicHolidays(year: number): PublicHoliday[] {
  const easter = easterSunday(year);
  const y = String(year);
  return [
    { date: `${y}-01-01`, key: "newYear" },
    { date: addDays(easter, 1), key: "easterMonday" },
    { date: `${y}-05-01`, key: "labourDay" },
    { date: `${y}-05-08`, key: "victoryDay" },
    { date: addDays(easter, 39), key: "ascension" },
    { date: addDays(easter, 50), key: "whitMonday" },
    { date: `${y}-07-14`, key: "bastilleDay" },
    { date: `${y}-08-15`, key: "assumption" },
    { date: `${y}-11-01`, key: "allSaints" },
    { date: `${y}-11-11`, key: "armistice" },
    { date: `${y}-12-25`, key: "christmas" },
  ].sort((a, b) => a.date.localeCompare(b.date)) as PublicHoliday[];
}

/** Public holidays with `from <= date < to`. */
export function frenchPublicHolidaysBetween(from: DateKey, to: DateKey): PublicHoliday[] {
  const first = Number(from.slice(0, 4));
  const last = Number(to.slice(0, 4));
  const all: PublicHoliday[] = [];
  for (let year = first; year <= last; year++) all.push(...frenchPublicHolidays(year));
  return all.filter((h) => h.date >= from && h.date < to);
}
