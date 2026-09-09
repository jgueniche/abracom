import { parseColor, rgbToHex } from "./color.ts";

/**
 * Brand colours extracted from the official logo (scripts/brand/extract-palette.mjs).
 * The CSS design tokens live in app/globals.css; the values below are the few the
 * TypeScript side needs (PWA manifest, theme-color meta, icon generation).
 * tests/unit/design-tokens.test.ts checks they stay in sync with the CSS.
 */
export const brand = {
  teal: "#01525e", // aleph + star of David
  red: "#852624", // wordmark + mandala
  gold: "#e3b383", // mandala petals
  sand: "#fbe29e", // mandala highlights
  taupe: "#584a47", // hand-drawn book strokes
} as const;

/** `--background` of each theme, as written in app/globals.css. */
export const themeBackground = {
  light: "oklch(0.949 0.016 253.9)",
  dark: "oklch(0.194 0.035 256.5)",
} as const;

export const themeColorHex = {
  light: rgbToHex(parseColor(themeBackground.light)),
  dark: rgbToHex(parseColor(themeBackground.dark)),
} as const;

/** Colour used behind the logo on app icons and splash screens. */
export const iconBackgroundHex = themeColorHex.light;
