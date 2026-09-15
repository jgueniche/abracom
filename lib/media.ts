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
