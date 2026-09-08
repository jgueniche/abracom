import { addDays, localDateKey, localTime, zonedToUtc } from "@/lib/calendar/dates";
import { type GeoLocation, quietWindows } from "@/lib/hebcal";

import type { QuietHours } from "./kinds";

export type DeliveryPolicy = {
  quietHours: QuietHours | null;
  shabbatMode: boolean;
};

/**
 * Earliest instant at or after `now` when a push / e-mail may be sent (brief §7.8):
 * never during Shabbat / yom tov (candle lighting − 1 h → havdalah + 1 h, computed by hebcal for
 * the school's coordinates) and never during the user's quiet hours. Both rules are re-applied
 * until stable so a quiet-hours end falling on Shabbat is pushed further.
 */
export function nextAllowedTime(now: Date, policy: DeliveryPolicy, location: GeoLocation): Date {
  let candidate = now;
  for (let i = 0; i < 6; i++) {
    const shifted = applyShabbat(candidate, policy, location);
    const quiet = applyQuietHours(shifted, policy, location.timezone);
    if (quiet.getTime() === candidate.getTime()) return candidate;
    candidate = quiet;
  }
  return candidate;
}

function applyShabbat(at: Date, policy: DeliveryPolicy, location: GeoLocation): Date {
  if (!policy.shabbatMode) return at;
  const key = localDateKey(at, location.timezone);
  const window = quietWindows(addDays(key, -1), addDays(key, 1), location).find(
    (w) => new Date(w.start) <= at && at < new Date(w.end),
  );
  return window ? new Date(window.end) : at;
}

function applyQuietHours(at: Date, policy: DeliveryPolicy, timezone: string): Date {
  const hours = policy.quietHours;
  if (!hours || hours.start === hours.end) return at;
  const day = localDateKey(at, timezone);
  const time = localTime(at, timezone);
  const overnight = hours.start > hours.end;
  const inside = overnight
    ? time >= hours.start || time < hours.end
    : time >= hours.start && time < hours.end;
  if (!inside) return at;
  const endDay = overnight && time >= hours.start ? addDays(day, 1) : day;
  return zonedToUtc(`${endDay}T${hours.end}`, timezone);
}

export function isDeliverableNow(
  now: Date,
  policy: DeliveryPolicy,
  location: GeoLocation,
): boolean {
  return nextAllowedTime(now, policy, location).getTime() === now.getTime();
}

/** The daily digest goes out in the evening of the school's time zone (17:00 – 21:00 by default). */
export function isDigestWindow(now: Date, timeZone: string, fromHour = 17, toHour = 21): boolean {
  const hour = Number(localTime(now, timeZone).slice(0, 2));
  return hour >= fromHour && hour < toHour;
}
