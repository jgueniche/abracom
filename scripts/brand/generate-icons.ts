import { mkdirSync } from "node:fs";

import sharp from "sharp";

import { iconBackgroundHex } from "../../lib/design/tokens.ts";

const SOURCE = "public/brand/logo-abravanel.png";
mkdirSync("public/icons", { recursive: true });

/** Fit the trimmed logo inside a square of `size`, leaving `padding` (0..1) around it. */
async function icon(size: number, padding: number, output: string) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(SOURCE)
    .trim()
    .resize({ width: inner, height: inner, fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
  const { width = inner, height = inner } = await sharp(logo).metadata();
  await sharp({
    create: { width: size, height: size, channels: 4, background: iconBackgroundHex },
  })
    .composite([
      { input: logo, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) },
    ])
    .png({ compressionLevel: 9 })
    .toFile(output);
  console.log(`${output} (${size}px)`);
}

await icon(256, 0.08, "app/icon.png"); // favicon (PNG, served by Next.js)
await icon(180, 0.1, "app/apple-icon.png"); // iOS home screen
await icon(192, 0.1, "public/icons/icon-192.png");
await icon(512, 0.1, "public/icons/icon-512.png");
await icon(192, 0.2, "public/icons/icon-maskable-192.png"); // safe zone for maskable icons
await icon(512, 0.2, "public/icons/icon-maskable-512.png");
