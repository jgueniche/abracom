import { describe, expect, it } from "vitest";

import { dayKey, isPhoto, parseAttachments, segmentMentions } from "@/lib/messaging/format";

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

  it("keeps the size and the light rendition of a photo, and nothing malformed", () => {
    const [photo] = parseAttachments([
      {
        path: "s/t/a.jpg",
        name: "devoir.jpg",
        size: 412_000,
        mime: "image/jpeg",
        width: 1536,
        height: 2048,
        thumb: "s/t/a.thumb.jpg",
        color: "#f4f1ea",
      },
    ]);
    expect(photo).toMatchObject({ width: 1536, height: 2048, thumb: "s/t/a.thumb.jpg" });
    const [old] = parseAttachments([
      { path: "s/t/b.jpg", name: "b.jpg", size: 1, mime: "image/jpeg", width: -3, color: "red" },
    ]);
    // a message sent before session 33 has neither: it shows the picture itself
    expect(old?.width).toBeUndefined();
    expect(old?.color).toBeUndefined();
  });

  it("tells a photo, shown in the conversation, from a document, linked", () => {
    expect(isPhoto({ path: "p", name: "n", size: 1, mime: "image/jpeg" })).toBe(true);
    expect(isPhoto({ path: "p", name: "n", size: 1, mime: "application/pdf" })).toBe(false);
  });
});
