import { addDays, isDateKey } from "./dates";

/**
 * Minimal RFC 5545 writer for the private per-user feed (no dependency).
 * Timed events are written in UTC; all-day events use DATE values with an exclusive DTEND.
 */
export type IcsEvent = {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  /** ISO instant for timed events, YYYY-MM-DD for all-day events. */
  start: string;
  /** ISO instant, or the inclusive last day (YYYY-MM-DD) of an all-day event. */
  end?: string | null;
  allDay: boolean;
  status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
  categories?: string[];
  /** ISO instant, used for LAST-MODIFIED. */
  updatedAt?: string | null;
};

export type IcsCalendar = {
  name: string;
  description?: string;
  timezone: string;
  events: IcsEvent[];
  /** Injected by tests for stable DTSTAMP values. */
  now?: Date;
  refreshMinutes?: number;
};

const encoder = new TextEncoder();
const LINE_LIMIT = 75;

/** Escapes TEXT values (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds a content line at 75 octets without splitting UTF-8 sequences (§3.1). */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = "";
  let limit = LINE_LIMIT;
  for (const char of line) {
    if (encoder.encode(current + char).length > limit) {
      out.push(current);
      current = " " + char;
      limit = LINE_LIMIT;
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.join("\r\n");
}

export function formatUtc(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function formatDate(key: string): string {
  return key.replace(/-/g, "");
}

function property(name: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return foldLine(`${name}:${escapeText(value)}`);
}

function eventLines(event: IcsEvent, stamp: string): string[] {
  const lines: string[] = ["BEGIN:VEVENT", foldLine(`UID:${event.uid}`), `DTSTAMP:${stamp}`];
  if (event.allDay) {
    if (!isDateKey(event.start)) throw new Error(`All-day event needs a date key: ${event.uid}`);
    const last = event.end && isDateKey(event.end) ? event.end : event.start;
    lines.push(`DTSTART;VALUE=DATE:${formatDate(event.start)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDate(addDays(last, 1))}`);
  } else {
    lines.push(`DTSTART:${formatUtc(event.start)}`);
    if (event.end) lines.push(`DTEND:${formatUtc(event.end)}`);
  }
  for (const line of [
    property("SUMMARY", event.title),
    property("DESCRIPTION", event.description),
    property("LOCATION", event.location),
    event.url ? foldLine(`URL:${event.url}`) : null,
    event.status ? `STATUS:${event.status}` : null,
    event.categories?.length
      ? foldLine(`CATEGORIES:${event.categories.map(escapeText).join(",")}`)
      : null,
    event.updatedAt ? `LAST-MODIFIED:${formatUtc(event.updatedAt)}` : null,
  ]) {
    if (line) lines.push(line);
  }
  lines.push("END:VEVENT");
  return lines;
}

export function buildIcs(calendar: IcsCalendar): string {
  const stamp = formatUtc(calendar.now ?? new Date());
  const refresh = `PT${calendar.refreshMinutes ?? 60}M`;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kesher//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escapeText(calendar.name)}`),
    foldLine(`X-WR-TIMEZONE:${calendar.timezone}`),
    `REFRESH-INTERVAL;VALUE=DURATION:${refresh}`,
    `X-PUBLISHED-TTL:${refresh}`,
  ];
  const description = property("X-WR-CALDESC", calendar.description);
  if (description) lines.push(description);
  for (const event of calendar.events) lines.push(...eventLines(event, stamp));
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
