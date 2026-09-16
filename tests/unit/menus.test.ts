import { describe, expect, it } from "vitest";

import { COLUMN_OF, COURSES, DAY_FIELDS, dayFieldName, MENU_DAYS, menuWeekOf } from "@/lib/menus";

describe("the week a menu reader is asking about", () => {
  it("is the current one from Monday to Friday", () => {
    // 2026-09-14 is a Monday
    expect(menuWeekOf("2026-09-14")).toBe("2026-09-14");
    expect(menuWeekOf("2026-09-16")).toBe("2026-09-14");
    expect(menuWeekOf("2026-09-18")).toBe("2026-09-14");
  });

  it("is the week that starts, once the weekend has come", () => {
    // A canteen menu is looked up on a Sunday evening for the day after:
    // answering with the week that has just ended is five days of meals
    // already eaten.
    expect(menuWeekOf("2026-09-19")).toBe("2026-09-21"); // Saturday
    expect(menuWeekOf("2026-09-20")).toBe("2026-09-21"); // Sunday
  });

  it("crosses a year boundary like any other week", () => {
    expect(menuWeekOf("2027-01-03")).toBe("2027-01-04"); // Sunday
    expect(menuWeekOf("2027-01-04")).toBe("2027-01-04"); // Monday
  });
});

describe("the shape of a menu", () => {
  it("names the five school days and the five courses of a day", () => {
    expect(MENU_DAYS).toEqual([1, 2, 3, 4, 5]);
    expect(COURSES).toEqual(["starter", "mainCourse", "side", "dessert", "snack"]);
    expect(DAY_FIELDS).toEqual([...COURSES, "note"]);
  });

  it("maps every field to a column of weekly_menu_days", () => {
    // A field with no column would be typed by the office and dropped in
    // silence — the form and the table have to name the same things.
    for (const field of DAY_FIELDS) expect(COLUMN_OF[field], field).toBeTruthy();
    expect(COLUMN_OF.mainCourse).toBe("main_course");
  });

  it("gives each field of each day its own form name", () => {
    const names = MENU_DAYS.flatMap((day) => DAY_FIELDS.map((f) => dayFieldName(day, f)));
    expect(new Set(names).size).toBe(names.length);
    expect(dayFieldName(3, "mainCourse")).toBe("mainCourse-3");
  });
});
