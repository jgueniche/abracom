import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  hexToRgb,
  oklchToRgb,
  parseColor,
  rgbToHex,
  rgbToOklch,
} from "@/lib/design/color";

describe("colour conversions", () => {
  it("round-trips hex", () => {
    expect(rgbToHex(hexToRgb("#01525e"))).toBe("#01525e");
    expect(rgbToHex(hexToRgb("#fff"))).toBe("#ffffff");
  });

  it("maps OKLCH extremes to white and black", () => {
    expect(rgbToHex(oklchToRgb({ l: 1, c: 0, h: 0 }))).toBe("#ffffff");
    expect(rgbToHex(oklchToRgb({ l: 0, c: 0, h: 0 }))).toBe("#000000");
  });

  it("round-trips the brand teal through OKLCH", () => {
    const oklch = rgbToOklch(hexToRgb("#01525e"));
    expect(oklch.l).toBeCloseTo(0.403, 2);
    expect(oklch.c).toBeCloseTo(0.07, 2);
    expect(oklch.h).toBeCloseTo(211.7, 0);
    expect(rgbToHex(oklchToRgb(oklch))).toBe("#01525e");
  });

  it("parses the formats returned by getComputedStyle", () => {
    expect(rgbToHex(parseColor("rgb(1, 82, 94)"))).toBe("#01525e");
    expect(rgbToHex(parseColor("rgba(1, 82, 94, 0.5)"))).toBe("#01525e");
    expect(rgbToHex(parseColor("color(srgb 1 1 1)"))).toBe("#ffffff");
    expect(rgbToHex(parseColor("oklch(1 0 0)"))).toBe("#ffffff");
    // Chromium reports oklch tokens as CIE Lab (D50): --primary → #0a5763
    expect(rgbToHex(parseColor("lab(33.2129 -18.7131 -13.7118)"))).toBe("#0a5763");
    expect(rgbToHex(parseColor("lab(100 0 0)"))).toBe("#ffffff");
    expect(rgbToHex(parseColor("oklab(0.42 -0.0594 -0.0371)"))).toBe(
      rgbToHex(parseColor("oklch(0.42 0.07 212)")),
    );
    expect(() => parseColor("papayawhip")).toThrow(/non reconnue/);
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });
});
