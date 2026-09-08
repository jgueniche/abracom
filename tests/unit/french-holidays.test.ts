import { describe, expect, it } from "vitest";

import {
  easterSunday,
  frenchPublicHolidays,
  frenchPublicHolidaysBetween,
} from "@/lib/calendar/french-holidays";

describe("french public holidays", () => {
  it("computes Easter", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2038)).toBe("2038-04-25");
  });

  it("lists the eleven holidays of a year, sorted", () => {
    const holidays = frenchPublicHolidays(2027);
    expect(holidays).toHaveLength(11);
    expect(holidays.map((h) => h.date)).toEqual([...holidays.map((h) => h.date)].sort());
    expect(holidays).toContainEqual({ date: "2027-03-29", key: "easterMonday" });
    expect(holidays).toContainEqual({ date: "2027-05-06", key: "ascension" });
    expect(holidays).toContainEqual({ date: "2027-05-17", key: "whitMonday" });
  });

  it("filters a school year", () => {
    const keys = frenchPublicHolidaysBetween("2026-09-01", "2027-07-06").map((h) => h.key);
    expect(keys).toEqual([
      "allSaints",
      "armistice",
      "christmas",
      "newYear",
      "easterMonday",
      "labourDay",
      "ascension",
      "victoryDay",
      "whitMonday",
    ]);
  });
});
