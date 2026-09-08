import { describe, expect, it } from "vitest";

import { localTime } from "@/lib/calendar/dates";
import { hebrewDate, isQuietTime, jewishCalendar, parashaOfWeek, quietWindows } from "@/lib/hebcal";

describe("jewishCalendar", () => {
  const items = jewishCalendar({ from: "2026-09-10", to: "2026-09-30", locale: "fr" });
  const holiday = (date: string) => items.find((i) => i.date === date && i.kind === "holiday");

  it("categorises holidays and marks yom tov days", () => {
    expect(holiday("2026-09-12")).toMatchObject({
      title: "Roch Hachanah 5787",
      category: "major",
      yomTov: true,
    });
    expect(holiday("2026-09-11")).toMatchObject({ category: "erev", yomTov: false });
    expect(holiday("2026-09-14")).toMatchObject({ title: "Tzom Guedalyah", category: "fast" });
    expect(holiday("2026-09-21")).toMatchObject({
      title: "Yom Kippour",
      category: "major",
      yomTov: true,
    });
    expect(holiday("2026-09-28")).toMatchObject({ category: "cholHamoed", yomTov: false });
  });

  it("adds the day after a yom tov (isru chag) unless it is already a holiday", () => {
    expect(holiday("2026-09-22")).toMatchObject({ category: "isruChag", title: "Yom Kippour" });
    expect(items.filter((i) => i.date === "2026-09-14" && i.category === "isruChag")).toHaveLength(
      0,
    );
  });

  it("computes candle lighting, havdalah and the parasha for Neuilly", () => {
    expect(items.find((i) => i.date === "2026-09-18" && i.kind === "candles")).toMatchObject({
      time: "19:39",
      at: "2026-09-18T17:39:00.000Z",
    });
    expect(items.find((i) => i.date === "2026-09-19" && i.kind === "havdalah")?.time).toBe("20:43");
    expect(items.find((i) => i.date === "2026-09-19" && i.kind === "parasha")?.title).toBe(
      "Ha’Azinou",
    );
    expect(items.some((i) => i.title.startsWith("Début du jeûne"))).toBe(false);
  });

  it("renders Rosh Chodesh, Chanukah and English titles", () => {
    const october = jewishCalendar({ from: "2026-10-11", to: "2026-10-12" });
    expect(october.filter((i) => i.category === "roshChodesh")).toHaveLength(2);
    const chanukah = jewishCalendar({ from: "2026-12-05", to: "2026-12-05", locale: "en" });
    expect(chanukah.find((i) => i.kind === "holiday")).toMatchObject({
      title: "Chanukah: 2 Candles",
      category: "minor",
    });
  });
});

describe("hebrew dates and parasha", () => {
  it("formats the Hebrew date in both languages", () => {
    expect(hebrewDate("2026-09-08", "fr")).toBe("26 Eloul 5786");
    expect(hebrewDate("2026-09-08", "en")).toBe("26 Elul 5786");
  });

  it("finds the parasha of the week from any weekday", () => {
    expect(parashaOfWeek("2026-09-15", "fr")).toBe("Ha’Azinou");
    expect(parashaOfWeek("2026-09-19", "fr")).toBe("Ha’Azinou");
    expect(parashaOfWeek("2026-09-26", "fr")).toBeNull(); // Sukkot I
  });
});

describe("quiet windows (Shabbat / yom tov mode)", () => {
  it("opens one hour before candle lighting and closes one hour after havdalah", () => {
    const windows = quietWindows("2026-09-18", "2026-09-19");
    expect(windows).toHaveLength(1);
    expect(localTime(windows[0]!.start, "Europe/Paris")).toBe("18:39");
    expect(localTime(windows[0]!.end, "Europe/Paris")).toBe("21:43");
  });

  it("merges consecutive Shabbat and yom tov days", () => {
    // Rosh Hashana 5787: Friday 11/09 candles → Sunday 13/09 havdalah
    const windows = quietWindows("2026-09-11", "2026-09-13");
    expect(windows).toHaveLength(1);
    expect(windows[0]!.start.slice(0, 10)).toBe("2026-09-11");
    expect(windows[0]!.end.slice(0, 10)).toBe("2026-09-13");
  });

  it("tells whether an instant is quiet", () => {
    expect(isQuietTime(new Date("2026-09-18T19:00:00Z"))).toBe(true);
    expect(isQuietTime(new Date("2026-09-16T10:00:00Z"))).toBe(false);
  });
});
