import sharp from "sharp";

const file = "/home/user/abracom/public/brand/logo-abravanel.png";
const { data, info } = await sharp(file).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

// Quantize opaque, non-white, non-grey-ish pixels into buckets and count them.
const buckets = new Map();
const step = 12;
let opaque = 0;
for (let i = 0; i < data.length; i += channels) {
  const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
  if (a < 200) continue;
  opaque++;
  const key = [
    Math.round(r / step) * step,
    Math.round(g / step) * step,
    Math.round(b / step) * step,
  ].join(",");
  const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
  cur.n++;
  cur.r += r;
  cur.g += g;
  cur.b += b;
  buckets.set(key, cur);
}
const toHex = (n) => n.toString(16).padStart(2, "0");
const rows = [...buckets.values()]
  .map((c) => ({
    n: c.n,
    hex: `#${toHex(Math.round(c.r / c.n))}${toHex(Math.round(c.g / c.n))}${toHex(Math.round(c.b / c.n))}`,
    r: c.r / c.n,
    g: c.g / c.n,
    b: c.b / c.n,
  }))
  .sort((a, b) => b.n - a.n);
const sat = (c) => {
  const mx = Math.max(c.r, c.g, c.b),
    mn = Math.min(c.r, c.g, c.b);
  return mx === 0 ? 0 : (mx - mn) / mx;
};
console.log(`image ${width}x${height}, opaque pixels ${opaque}`);
console.log("--- top buckets (all)");
for (const r of rows.slice(0, 12)) console.log(r.hex, r.n, `sat=${sat(r).toFixed(2)}`);
console.log("--- top saturated buckets (sat>0.35)");
for (const r of rows.filter((c) => sat(c) > 0.35).slice(0, 14))
  console.log(r.hex, r.n, `sat=${sat(r).toFixed(2)}`);
