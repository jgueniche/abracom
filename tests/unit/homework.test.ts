import { describe, expect, it } from "vitest";

import {
  defaultWeek,
  nextLessonDay,
  nextSchoolDay,
  normalizeSubject,
  pivotDay,
  pivotLabel,
  progressOf,
  subjectTone,
  suggestedSubjects,
  SUBJECT_TONES,
  upcomingSchoolDays,
  weekDays,
} from "@/lib/homework";

// 2026-10-05 is a Monday; October is summer time in Paris (UTC+2), December winter time (UTC+1).
const at = (iso: string) => new Date(iso);

describe("the day a family is preparing for", () => {
  it("is today until noon, when today's homework has been handed in", () => {
    expect(pivotDay(at("2026-10-06T09:59:00Z"))).toBe("2026-10-06"); // Tuesday 11:59 in Paris
    expect(pivotDay(at("2026-10-06T10:00:00Z"))).toBe("2026-10-07"); // Tuesday 12:00 in Paris
    expect(pivotDay(at("2026-10-06T17:30:00Z"))).toBe("2026-10-07"); // Tuesday evening
  });

  it("is the Monday from Friday noon and over the weekend", () => {
    expect(pivotDay(at("2026-10-09T08:00:00Z"))).toBe("2026-10-09"); // Friday 10:00
    expect(pivotDay(at("2026-10-09T10:30:00Z"))).toBe("2026-10-12"); // Friday 12:30
    expect(pivotDay(at("2026-10-10T09:00:00Z"))).toBe("2026-10-12"); // Saturday
    expect(pivotDay(at("2026-10-11T21:30:00Z"))).toBe("2026-10-12"); // Sunday 23:30
  });

  it("reads the hour in Paris, winter time included", () => {
    // 11:30 UTC is 12:30 in Paris in December: the morning is over.
    expect(pivotDay(at("2026-12-01T11:30:00Z"))).toBe("2026-12-02");
    expect(pivotDay(at("2026-12-01T10:30:00Z"))).toBe("2026-12-01");
    // 23:30 UTC on a Tuesday is already Wednesday in Paris.
    expect(pivotDay(at("2026-12-01T23:30:00Z"))).toBe("2026-12-02");
  });

  it("is named the way a parent says it", () => {
    expect(pivotLabel("2026-10-06", at("2026-10-06T07:00:00Z"))).toBe("today");
    expect(pivotLabel("2026-10-07", at("2026-10-06T17:00:00Z"))).toBe("tomorrow");
    expect(pivotLabel("2026-10-12", at("2026-10-09T17:00:00Z"))).toBe("weekday");
  });
});

describe("the week the diary opens on", () => {
  it("is the current week while it still has a day to prepare", () => {
    expect(defaultWeek(at("2026-10-05T06:00:00Z"))).toBe("2026-10-05");
    expect(defaultWeek(at("2026-10-08T18:00:00Z"))).toBe("2026-10-05"); // Thursday evening
  });

  it("is the week that starts, from Friday noon", () => {
    expect(defaultWeek(at("2026-10-09T15:00:00Z"))).toBe("2026-10-12");
    expect(defaultWeek(at("2026-10-11T08:00:00Z"))).toBe("2026-10-12");
  });

  it("crosses a year boundary like any other week", () => {
    expect(defaultWeek(at("2027-01-01T15:00:00Z"))).toBe("2027-01-04"); // Friday afternoon
  });
});

describe("school days", () => {
  it("skip the weekend", () => {
    expect(nextSchoolDay("2026-10-09")).toBe("2026-10-12");
    expect(nextSchoolDay("2026-10-06")).toBe("2026-10-07");
    expect(upcomingSchoolDays("2026-10-08", 3)).toEqual(["2026-10-09", "2026-10-12", "2026-10-13"]);
  });

  it("make a week of five days, and a weekend day only when something is due on it", () => {
    expect(weekDays("2026-10-05")).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
    expect(weekDays("2026-10-05", new Set(["2026-10-10"]))).toHaveLength(6);
  });
});

describe("the next lesson of a subject", () => {
  const slots = [
    { weekday: 1, subject: "Français" },
    { weekday: 4, subject: "Français" },
    { weekday: 2, subject: "Mathématiques" },
  ];

  it("is the next day of the week the timetable gives it", () => {
    expect(nextLessonDay(slots, "Français", "2026-10-06")).toBe("2026-10-08");
    expect(nextLessonDay(slots, "  francais ", "2026-10-08")).toBe("2026-10-12");
  });

  it("is never the day itself — homework is set for a later lesson", () => {
    expect(nextLessonDay(slots, "Mathématiques", "2026-10-06")).toBe("2026-10-13");
  });

  it("is unknown when the timetable does not teach it", () => {
    expect(nextLessonDay(slots, "Anglais", "2026-10-06")).toBeNull();
    expect(nextLessonDay(slots, "", "2026-10-06")).toBeNull();
  });
});

describe("subjects", () => {
  it("are one subject whatever the case and the accents", () => {
    expect(normalizeSubject("  MATHÉMATIQUES ")).toBe("mathematiques");
    expect(normalizeSubject("Hébreu")).toBe(normalizeSubject("hebreu"));
  });

  it("are suggested from the timetable first, then from past homework, each once", () => {
    expect(
      suggestedSubjects(
        [
          { weekday: 1, subject: "Français" },
          { weekday: 2, subject: "Mathématiques" },
          { weekday: 4, subject: "Français" },
        ],
        ["francais", "Hébreu", null, "", "Mathematiques", "Anglais"],
      ),
    ).toEqual(["Français", "Mathématiques", "Hébreu", "Anglais"]);
  });

  it("keep one colour from day to day", () => {
    expect(subjectTone("Français")).toBe("blue");
    expect(subjectTone("Poésie")).toBe("blue");
    expect(subjectTone("Mathématiques")).toBe("green");
    expect(subjectTone("Hébreu")).toBe("violet");
    expect(subjectTone("Kodech")).toBe("violet");
    expect(subjectTone("Anglais")).toBe("amber");
    expect(subjectTone("Questionner le monde")).toBe("teal");
    expect(subjectTone("EPS")).toBe("red");
    expect(subjectTone(null)).toBe("slate");
    // an unknown subject still gets a colour, and always the same one
    expect(SUBJECT_TONES).toContain(subjectTone("Jardinage"));
    expect(subjectTone("Jardinage")).toBe(subjectTone("jardinage"));
  });
});

describe("progress", () => {
  it("is complete only when there was something to do", () => {
    expect(progressOf(0, 0).complete).toBe(false);
    expect(progressOf(3, 3).complete).toBe(true);
    expect(progressOf(3, 5)).toEqual({ total: 3, done: 3, complete: true });
  });
});
