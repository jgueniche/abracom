import { describe, expect, it } from "vitest";

import { localTime } from "@/lib/calendar/dates";
import { DEFAULT_LOCATION } from "@/lib/hebcal";
import { isDeliverableNow, nextAllowedTime } from "@/lib/notifications/schedule";

const paris = (iso: string) => localTime(iso, "Europe/Paris");

describe("nextAllowedTime (Shabbat mode and quiet hours)", () => {
  const policy = { quietHours: { start: "21:00", end: "07:00" }, shabbatMode: true };

  it("sends immediately on a weekday afternoon", () => {
    const now = new Date("2026-09-16T12:00:00Z");
    expect(nextAllowedTime(now, policy, DEFAULT_LOCATION)).toEqual(now);
    expect(isDeliverableNow(now, policy, DEFAULT_LOCATION)).toBe(true);
  });

  it("holds during quiet hours until 07:00 local time", () => {
    const at = nextAllowedTime(new Date("2026-09-16T20:30:00Z"), policy, DEFAULT_LOCATION); // 22:30 Paris
    expect(at.toISOString()).toBe("2026-09-17T05:00:00.000Z");
    expect(paris(at.toISOString())).toBe("07:00");
    const early = nextAllowedTime(new Date("2026-09-17T02:00:00Z"), policy, DEFAULT_LOCATION); // 04:00 Paris
    expect(early.toISOString()).toBe("2026-09-17T05:00:00.000Z");
  });

  it("queues everything sent during a simulated Shabbat until one hour after havdalah", () => {
    // Friday 18 September 2026, 19:00 Paris: candle lighting is at 19:39, the window opens at 18:39
    const friday = new Date("2026-09-18T17:00:00Z");
    const at = nextAllowedTime(friday, { quietHours: null, shabbatMode: true }, DEFAULT_LOCATION);
    expect(at.toISOString()).toBe("2026-09-19T19:43:00.000Z"); // havdalah 20:43 + 1 h (Paris)
    expect(paris(at.toISOString())).toBe("21:43");
    // Saturday noon is still inside the window; the release time is then in quiet hours → 07:00 Sunday
    const saturday = new Date("2026-09-19T10:00:00Z");
    expect(nextAllowedTime(saturday, policy, DEFAULT_LOCATION).toISOString()).toBe(
      "2026-09-20T05:00:00.000Z",
    );
  });

  it("ignores Shabbat when the user disabled Shabbat mode", () => {
    const friday = new Date("2026-09-18T18:00:00Z"); // 20:00 Paris, before quiet hours
    expect(
      nextAllowedTime(friday, { quietHours: null, shabbatMode: false }, DEFAULT_LOCATION),
    ).toEqual(friday);
  });

  it("covers yom tov spanning several days (Rosh Hashana 5787)", () => {
    const at = nextAllowedTime(
      new Date("2026-09-12T10:00:00Z"),
      { quietHours: null, shabbatMode: true },
      DEFAULT_LOCATION,
    );
    expect(at.toISOString().slice(0, 10)).toBe("2026-09-13");
    expect(at.getTime()).toBeGreaterThan(new Date("2026-09-13T18:00:00Z").getTime());
  });
});
