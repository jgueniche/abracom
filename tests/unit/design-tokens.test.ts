import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio, hexToRgb, parseColor, rgbToHex, WCAG_AA_TEXT } from "@/lib/design/color";
import { brand, themeBackground } from "@/lib/design/tokens";

const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

function tokens(selector: string): Record<string, string> {
  const escaped = selector.replace(".", "\\.");
  const body = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
  const vars: Record<string, string> = {};
  for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[match[1]!] = match[2]!.trim();
  return vars;
}

const light = tokens(":root");
const dark = { ...light, ...tokens(".dark") };

const TEXT_PAIRS: Array<[string, string]> = [
  ["background", "foreground"],
  ["surface", "surface-foreground"],
  ["card", "card-foreground"],
  ["popover", "popover-foreground"],
  ["primary", "primary-foreground"],
  ["secondary", "secondary-foreground"],
  ["muted", "muted-foreground"],
  ["accent", "accent-foreground"],
  ["background", "muted-foreground"],
  ["card", "muted-foreground"],
  ["brick", "brick-foreground"],
  ["background", "brick"],
  ["card", "brick"],
  ["success", "success-foreground"],
  ["warning", "warning-foreground"],
];

/**
 * The old palette passed every contrast test and still looked flat: card on
 * background was 1.04:1. Planes only read as planes when they are separated,
 * so the separation itself is a test now.
 */
const SURFACE_PAIRS: Array<[string, string, number]> = [
  ["background", "card", 1.15],
  ["background", "surface", 1.12],
  ["card", "border", 1.4],
  ["background", "border", 1.35],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme tokens", (_name, vars) => {
  it.each(TEXT_PAIRS)("--%s / --%s meets WCAG AA (4.5:1)", (bg, fg) => {
    expect(vars[bg], `--${bg} missing`).toBeDefined();
    expect(vars[fg], `--${fg} missing`).toBeDefined();
    expect(contrastRatio(vars[bg]!, vars[fg]!)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it.each(SURFACE_PAIRS)("--%s and --%s stay %f:1 apart", (a, b, min) => {
    expect(contrastRatio(vars[a]!, vars[b]!)).toBeGreaterThanOrEqual(min);
  });

  it("keeps white text readable on destructive", () => {
    const onDestructive = _name === "dark" ? vars["background"]! : "#ffffff";
    expect(contrastRatio(vars["destructive"]!, onDestructive)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it("keeps the focus ring visible against the page (3:1)", () => {
    expect(contrastRatio(vars["ring"]!, vars["background"]!)).toBeGreaterThanOrEqual(3);
  });

  // WCAG SC 1.4.11: the border of a form control is a non-text contrast target.
  it("keeps field borders at 3:1 against page and card", () => {
    expect(contrastRatio(vars["input"]!, vars["background"]!)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(vars["input"]!, vars["card"]!)).toBeGreaterThanOrEqual(3);
  });
});

describe("token parity between CSS and TypeScript", () => {
  it("exposes the same --background values as lib/design/tokens.ts", () => {
    expect(tokens(":root")["background"]).toBe(themeBackground.light);
    expect(tokens(".dark")["background"]).toBe(themeBackground.dark);
  });

  it("keeps --brand-* within 2/255 of the extracted logo colours", () => {
    const pairs: Array<[string, string]> = [
      ["brand-teal", brand.teal],
      ["brand-red", brand.red],
      ["brand-gold", brand.gold],
      ["brand-sand", brand.sand],
      ["brand-taupe", brand.taupe],
    ];
    for (const [token, hex] of pairs) {
      const fromCss = parseColor(light[token]!);
      const expected = hexToRgb(hex);
      for (const channel of ["r", "g", "b"] as const) {
        expect(
          Math.abs(fromCss[channel] - expected[channel]) * 255,
          `${token} ${rgbToHex(fromCss)} vs ${hex}`,
        ).toBeLessThanOrEqual(2);
      }
    }
  });

  it("declares every colour token in both themes", () => {
    const colours = Object.keys(light).filter(
      (name) => !name.startsWith("brand-") && light[name]!.startsWith("oklch"),
    );
    const overridden = tokens(".dark");
    for (const name of colours)
      expect(overridden[name], `--${name} missing in .dark`).toBeDefined();
  });
});
