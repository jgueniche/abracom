/**
 * Small, dependency-free colour utilities used by the design tokens, the /dev/ui
 * style guide and the WCAG contrast tests. Supports `#rrggbb`, `#rgb`,
 * `oklch()`, `oklab()`, `lab()`, `rgb()` / `rgba()` and `color(srgb …)`
 * (alpha is ignored for contrast).
 */

export type Rgb = { r: number; g: number; b: number }; // 0..1, linear-free sRGB
export type Oklch = { l: number; c: number; h: number };

export function parseColor(input: string): Rgb {
  const value = input.trim();
  if (value.startsWith("#")) return hexToRgb(value);
  const match = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+%?)?\s*\)$/i.exec(
    value,
  );
  if (match) {
    const [, lRaw, cRaw, hRaw] = match;
    const l = lRaw!.endsWith("%") ? Number(lRaw!.slice(0, -1)) / 100 : Number(lRaw);
    return oklchToRgb({ l, c: Number(cRaw), h: Number(hRaw) });
  }
  const lab = /^lab\(\s*([\d.-]+%?)\s+([\d.-]+%?)\s+([\d.-]+%?)(?:\s*\/\s*[\d.]+%?)?\s*\)$/i.exec(
    value,
  );
  if (lab) {
    return cielabToRgb(
      labChannel(lab[1]!, 100),
      labChannel(lab[2]!, 125),
      labChannel(lab[3]!, 125),
    );
  }
  const oklab =
    /^oklab\(\s*([\d.-]+%?)\s+([\d.-]+%?)\s+([\d.-]+%?)(?:\s*\/\s*[\d.]+%?)?\s*\)$/i.exec(value);
  if (oklab) {
    return oklabToRgb(
      labChannel(oklab[1]!, 1),
      labChannel(oklab[2]!, 0.4),
      labChannel(oklab[3]!, 0.4),
    );
  }
  const rgb =
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/i.exec(
      value,
    );
  if (rgb) {
    return { r: Number(rgb[1]) / 255, g: Number(rgb[2]) / 255, b: Number(rgb[3]) / 255 };
  }
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+%?)?\s*\)$/i.exec(
    value,
  );
  if (srgb) {
    return { r: Number(srgb[1]), g: Number(srgb[2]), b: Number(srgb[3]) };
  }
  throw new Error(`Couleur non reconnue : ${input}`);
}

export function hexToRgb(hex: string): Rgb {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((ch) => ch + ch).join("");
  if (h.length !== 6) throw new Error(`Hex invalide : ${hex}`);
  const n = Number.parseInt(h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** A `lab()` / `oklab()` channel: plain number, or a percentage of `reference`. */
function labChannel(raw: string, reference: number): number {
  return raw.endsWith("%") ? (Number(raw.slice(0, -1)) / 100) * reference : Number(raw);
}

/** OKLab → sRGB (Björn Ottosson's reference matrices). */
export function oklabToRgb(l: number, a: number, b: number): Rgb {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  return linearToRgb(
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  );
}

export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180;
  return oklabToRgb(l, c * Math.cos(hr), c * Math.sin(hr));
}

/**
 * CIE Lab (D50, as used by CSS `lab()` and returned by Chromium's getComputedStyle)
 * → XYZ D50 → XYZ D65 (Bradford) → sRGB. Matrices from CSS Color Level 4.
 */
export function cielabToRgb(l: number, a: number, b: number): Rgb {
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const xr = fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa;
  const yr = l > kappa * epsilon ? fy ** 3 : l / kappa;
  const zr = fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa;

  // D50 reference white (x = 0.3457, y = 0.3585)
  const x50 = (xr * 0.3457) / 0.3585;
  const y50 = yr;
  const z50 = (zr * (1 - 0.3457 - 0.3585)) / 0.3585;

  // Bradford chromatic adaptation D50 → D65
  const x = 0.9554734527042182 * x50 - 0.023098536874261423 * y50 + 0.0632593086610217 * z50;
  const y = -0.028369706963208136 * x50 + 1.0099954580058226 * y50 + 0.021041398966943008 * z50;
  const z = 0.012314001688319899 * x50 - 0.020507696433477912 * y50 + 1.3303659366080753 * z50;

  return linearToRgb(
    3.2409699419045226 * x - 1.537383177570094 * y - 0.4986107602930034 * z,
    -0.9692436362808796 * x + 1.8759675015077202 * y + 0.04155505740717559 * z,
    0.05563007969699366 * x - 0.20397695888897652 * y + 1.0569715142428786 * z,
  );
}

function linearToRgb(rLin: number, gLin: number, bLin: number): Rgb {
  return {
    r: clamp01(linearToSrgb(rLin)),
    g: clamp01(linearToSrgb(gLin)),
    b: clamp01(linearToSrgb(bLin)),
  };
}

export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const l_ = Math.cbrt(0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl);
  const m_ = Math.cbrt(0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl);
  const s_ = Math.cbrt(0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const c = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 1e-4 ? 0 : h };
}

export function formatOklch({ l, c, h }: Oklch, digits = 3): string {
  return `oklch(${l.toFixed(digits)} ${c.toFixed(digits)} ${h.toFixed(1)})`;
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG 2.x contrast ratio between two colours (1..21). */
export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const la = relativeLuminance(typeof a === "string" ? parseColor(a) : a);
  const lb = relativeLuminance(typeof b === "string" ? parseColor(b) : b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

export const WCAG_AA_TEXT = 4.5;
export const WCAG_AA_LARGE_TEXT = 3;
