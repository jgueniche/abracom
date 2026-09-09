import "server-only";

import { encode } from "blurhash";
import sharp from "sharp";

export const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
export const MAX_IMAGE_EDGE = 1600;

export type ProcessedImage = {
  buffer: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
  blurhash: string;
};

/**
 * Normalises a photo before it reaches Storage: auto-rotation, resize to 1600 px max,
 * WebP re-encoding (drops EXIF / GPS metadata) and a blurhash placeholder.
 */
export async function processImage(input: Buffer | Uint8Array): Promise<ProcessedImage> {
  const pipeline = sharp(input, { failOn: "none" }).rotate();
  const { data, info } = await pipeline
    .clone()
    .resize({
      width: MAX_IMAGE_EDGE,
      height: MAX_IMAGE_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const preview = await sharp(data)
    .resize({ width: 32, height: 32, fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hash = encode(
    new Uint8ClampedArray(preview.data),
    preview.info.width,
    preview.info.height,
    4,
    3,
  );

  return {
    buffer: data,
    contentType: "image/webp",
    width: info.width,
    height: info.height,
    blurhash: hash,
  };
}

/**
 * Average colour encoded in a blurhash, without decoding the whole image.
 *
 * Every photo stored a blurhash and none of them ever used it: thumbnails
 * loaded over a flat grey square. The DC component sits in characters 2–5 and
 * is already sRGB-encoded, so this is enough for a placeholder that looks like
 * the picture instead of like a hole.
 */
const BASE83 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

export function blurhashAverageColor(hash: string | null | undefined): string | null {
  if (!hash || hash.length < 6) return null;
  let value = 0;
  for (const char of hash.slice(2, 6)) {
    const digit = BASE83.indexOf(char);
    if (digit < 0) return null;
    value = value * 83 + digit;
  }
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
