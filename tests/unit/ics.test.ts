import { describe, expect, it } from "vitest";

import { buildIcs, escapeText, foldLine } from "@/lib/calendar/ics";

const now = new Date("2026-09-08T10:00:00Z");

describe("ics", () => {
  it("escapes text values", () => {
    expect(escapeText("a, b; c\\d\nline")).toBe("a\\, b\; c\\\\d\\nline");
  });

  it("folds long lines at 75 octets without breaking UTF-8 characters", () => {
    const line = "SUMMARY:" + "é".repeat(80);
    const folded = foldLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    for (const part of parts.slice(1)) expect(part.startsWith(" ")).toBe(true);
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
  });

  it("writes timed events in UTC and all-day events with an exclusive end", () => {
    const ics = buildIcs({
      name: "Kesher · École",
      timezone: "Europe/Paris",
      now,
      events: [
        {
          uid: "a@kesher",
          title: "Réunion, salle 2",
          description: "Ligne 1\nLigne 2",
          location: "Salle polyvalente",
          start: "2026-09-15T16:30:00Z",
          end: "2026-09-15T18:00:00Z",
          allDay: false,
          status: "CONFIRMED",
          categories: ["meeting"],
          updatedAt: "2026-09-01T08:00:00Z",
        },
        {
          uid: "b@kesher",
          title: "Roch Hachana",
          start: "2026-09-12",
          end: "2026-09-13",
          allDay: true,
        },
      ],
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:Kesher · École");
    expect(ics).toContain("DTSTAMP:20260908T100000Z");
    expect(ics).toContain("DTSTART:20260915T163000Z");
    expect(ics).toContain("DTEND:20260915T180000Z");
    expect(ics).toContain("SUMMARY:Réunion\\, salle 2");
    expect(ics).toContain("DESCRIPTION:Ligne 1\\nLigne 2");
    expect(ics).toContain("LAST-MODIFIED:20260901T080000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260912");
    expect(ics).toContain("DTEND;VALUE=DATE:20260914");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
  });
});
