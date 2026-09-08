import { describe, expect, it } from "vitest";

import {
  addDays,
  diffDays,
  isoWeekday,
  localDateKey,
  localTime,
  monthRange,
  shiftMonth,
  utcToZonedNaive,
  zonedToUtc,
} from "@/lib/calendar/dates";

describe("calendar dates", () => {
  it("adds and diffs days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(diffDays("2026-09-08", "2026-09-15")).toBe(7);
  });

  it("knows weekdays and month ranges", () => {
    expect(isoWeekday("2026-09-19")).toBe(6); // Saturday
    expect(isoWeekday("2026-09-20")).toBe(7);
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", 3)).toBe("2027-02");
  });

  it("formats instants in the school timezone", () => {
    expect(localDateKey("2026-09-12T22:30:00Z", "Europe/Paris")).toBe("2026-09-13");
    expect(localTime("2026-09-12T22:30:00Z", "Europe/Paris")).toBe("00:30");
  });

  it("converts naive Paris date-times to UTC and back, across DST", () => {
    expect(zonedToUtc("2026-09-15T18:30", "Europe/Paris").toISOString()).toBe(
      "2026-09-15T16:30:00.000Z",
    );
    expect(zonedToUtc("2026-12-08T17:00", "Europe/Paris").toISOString()).toBe(
      "2026-12-08T16:00:00.000Z",
    );
    expect(zonedToUtc("2026-09-12", "Europe/Paris").toISOString()).toBe("2026-09-11T22:00:00.000Z");
    expect(utcToZonedNaive("2026-09-15T16:30:00Z", "Europe/Paris")).toBe("2026-09-15T18:30");
  });
});
