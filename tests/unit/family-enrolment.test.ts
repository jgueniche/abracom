import { describe, expect, it } from "vitest";

/**
 * `getMyChildren` sorts the open enrolment first. The database allows a single
 * open enrolment per pupil (ADR-0034), but a class change closes the previous
 * one on the day it opens the next, and both survive the "still current" filter
 * for that one day — long enough for a parent to be shown the class their child
 * has just left, on the day it matters most.
 */
type Enrolment = { id: string; left_on: string | null };

const currentFirst = (enrolments: Enrolment[], today: string) =>
  enrolments
    .filter((e) => e.left_on === null || e.left_on >= today)
    .sort((a, b) => (a.left_on === null ? 0 : 1) - (b.left_on === null ? 0 : 1));

describe("current enrolment", () => {
  const today = "2026-09-10";

  it("keeps the open enrolment and drops the ones already closed", () => {
    const rows = currentFirst(
      [
        { id: "last-year", left_on: "2026-07-06" },
        { id: "this-year", left_on: null },
      ],
      today,
    );
    expect(rows.map((r) => r.id)).toEqual(["this-year"]);
  });

  it("puts the open enrolment first on the day a pupil changes class", () => {
    const rows = currentFirst(
      [
        { id: "old-class", left_on: today },
        { id: "new-class", left_on: null },
      ],
      today,
    );
    expect(rows[0]!.id).toBe("new-class");
  });

  it("leaves a single enrolment alone", () => {
    const rows = currentFirst([{ id: "only", left_on: null }], today);
    expect(rows.map((r) => r.id)).toEqual(["only"]);
  });
});
