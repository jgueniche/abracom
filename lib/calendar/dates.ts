/** Small timezone-aware date helpers shared by the agenda and the ICS feed (no library). */

export type DateKey = string; // YYYY-MM-DD

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateKey(value: unknown): value is DateKey {
  return typeof value === "string" && KEY.test(value);
}

/** Local calendar date of an instant in `timeZone`. */
export function localDateKey(date: Date | string, timeZone: string): DateKey {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof date === "string" ? new Date(date) : date);
}

/** Local HH:mm of an instant in `timeZone`. */
export function localTime(date: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function parseDateKey(key: DateKey): { year: number; month: number; day: number } {
  const match = KEY.exec(key);
  if (!match) throw new Error(`Invalid date key: ${key}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** A Date at local midnight (JS runtime zone) for calendar libraries that read y/m/d. */
export function dateFromKey(key: DateKey): Date {
  const { year, month, day } = parseDateKey(key);
  return new Date(year, month - 1, day);
}

export function keyFromDate(date: Date): DateKey {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(key: DateKey, days: number): DateKey {
  const { year, month, day } = parseDateKey(key);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

/** Difference in days (b - a). */
export function diffDays(a: DateKey, b: DateKey): number {
  const pa = parseDateKey(a);
  const pb = parseDateKey(b);
  return Math.round(
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) /
      86_400_000,
  );
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(key: DateKey): number {
  const { year, month, day } = parseDateKey(key);
  const d = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** First and (exclusive) next-month keys for a `YYYY-MM` month. */
export function monthRange(month: string): { from: DateKey; to: DateKey } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error(`Invalid month: ${month}`);
  const year = Number(match[1]);
  const m = Number(match[2]);
  const next = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
}

export function shiftMonth(month: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error(`Invalid month: ${month}`);
  const total = Number(match[1]) * 12 + (Number(match[2]) - 1) + delta;
  const year = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${year}-${String(m).padStart(2, "0")}`;
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instant of a naive local date-time ("YYYY-MM-DDTHH:mm", as typed in a datetime-local input) in `timeZone`. */
export function zonedToUtc(naive: string, timeZone: string): Date {
  const [datePart, timePart = "00:00"] = naive.split("T");
  const { year, month, day } = parseDateKey(datePart!);
  const [hour = 0, minute = 0] = timePart.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess - tzOffsetMs(new Date(first), timeZone));
}

/** "YYYY-MM-DDTHH:mm" of an instant in `timeZone`, for datetime-local inputs. */
export function utcToZonedNaive(date: Date | string, timeZone: string): string {
  return `${localDateKey(date, timeZone)}T${localTime(date, timeZone)}`;
}
