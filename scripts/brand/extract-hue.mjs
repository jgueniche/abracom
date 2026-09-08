import sharp from "sharp";

// Usage: node scripts/brand/extract-hue.mjs <hueMin> <hueMax>  (degrees, 0-360)
const [hueMin = 20, hueMax = 60] = process.argv.slice(2).map(Number);
const file = "public/brand/logo-abravanel.png";
const { data, info } = await sharp(file).raw().ensureAlpha().toBuffer({ resolveWithObject: true });

function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}
const buckets = new Map();
for (let i = 0; i < data.length; i += info.channels) {
  const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
  if (a < 200) continue;
  const [h, s, v] = rgbToHsv(r, g, b);
  if (h < hueMin || h > hueMax || s < 0.35 || v < 0.35) continue;
  const key = [Math.round(r / 12) * 12, Math.round(g / 12) * 12, Math.round(b / 12) * 12].join(",");
  const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
  cur.n++;
  cur.r += r;
  cur.g += g;
  cur.b += b;
  buckets.set(key, cur);
}
const toHex = (n) => Math.round(n).toString(16).padStart(2, "0");
const rows = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 8);
for (const c of rows)
  console.log(`#${toHex(c.r / c.n)}${toHex(c.g / c.n)}${toHex(c.b / c.n)}`, c.n);
