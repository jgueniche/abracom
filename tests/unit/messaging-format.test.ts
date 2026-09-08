import { describe, expect, it } from "vitest";

import { dayKey, parseAttachments, segmentMentions } from "@/lib/messaging/format";

describe("segmentMentions", () => {
  it("highlights known members only, longest name first", () => {
    const segments = segmentMentions("Merci @Léa Cohen et @Léa !", ["Léa", "Léa Cohen"]);
    expect(segments).toEqual([
      { text: "Merci ", mention: false },
      { text: "@Léa Cohen", mention: true },
      { text: " et ", mention: false },
      { text: "@Léa", mention: true },
      { text: " !", mention: false },
    ]);
  });

  it("ignores unknown handles and escapes special characters", () => {
    expect(segmentMentions("Bonjour @Inconnu", ["Léa (PS)"])).toEqual([
      { text: "Bonjour @Inconnu", mention: false },
    ]);
    expect(segmentMentions("@Léa (PS) ok", ["Léa (PS)"])[0]).toEqual({
      text: "@Léa (PS)",
      mention: true,
    });
  });
});

describe("dayKey", () => {
  it("groups by Paris calendar day", () => {
    expect(dayKey("2026-09-08T23:30:00Z")).toBe("2026-09-09");
    expect(dayKey("2026-09-08T10:00:00Z")).toBe("2026-09-08");
  });
});

describe("parseAttachments", () => {
  it("keeps well-formed entries only", () => {
    expect(
      parseAttachments([
        { path: "a/b.pdf", name: "b.pdf", size: 1, mime: "application/pdf" },
        { nope: true },
        null,
      ]),
    ).toHaveLength(1);
    expect(parseAttachments("x")).toEqual([]);
  });
});
