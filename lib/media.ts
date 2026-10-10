import "server-only";

import { encode } from "blurhash";
import sharp from "sharp";

import { IMAGE_EDGES } from "@/lib/uploads/shared";

export const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
/** A photo of the cahier de vie: looked at on a screen. */
export const MAX_IMAGE_EDGE = IMAGE_EDGES.photo;
/** A page joined to a homework: read on a phone, and printed (see `IMAGE_EDGES`). */
export const PAGE_IMAGE_EDGE = IMAGE_EDGES.page;
/** The rendition shown in lists: a third of a phone's width at 3× density. */
export const THUMB_EDGE = IMAGE_EDGES.thumb;
const WEBP_EFFORT = 2;

export type ProcessedImage = {
  buffer: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
  blurhash: string;
  /** A light rendition for lists, when asked for. */
  thumb?: Buffer;
};

export type ProcessOptions = {
  maxEdge?: number;
  quality?: number;
  /** A quarter turn chosen by the person who joined the photo, on top of the EXIF orientation. */
  rotate?: 0 | 90 | 180 | 270;
  /** Also write a rendition this many pixels on its long edge. */
  thumbEdge?: number;
};

/**
 * Normalises a photo before it reaches the families: orientation from EXIF (then any quarter
 * turn the sender asked for), resize, WebP re-encoding — which drops every metadata block, GPS
 * included — and a blurhash placeholder (ADR-0019). Optionally a thumbnail for lists.
 */
export async function processImage(
  input: Buffer | Uint8Array,
  options: ProcessOptions = {},
): Promise<ProcessedImage> {
  const maxEdge = options.maxEdge ?? MAX_IMAGE_EDGE;
  const quality = options.quality ?? 82;
  let pipeline = sharp(input, { failOn: "none" }).autoOrient();
  if (options.rotate) pipeline = pipeline.rotate(options.rotate);
  const { data, info } = await pipeline
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    // Effort 2 rather than libvips' 4: measured on a 2 400 px page, 321 ms instead of 719 for
    // 2.5 % more bytes at the same quality — the publish button waits on this, once per page.
    .webp({ quality, effort: WEBP_EFFORT })
    .toBuffer({ resolveWithObject: true });

  const [preview, thumb] = await Promise.all([
    sharp(data)
      .resize({ width: 32, height: 32, fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    options.thumbEdge
      ? sharp(data)
          .resize({
            width: options.thumbEdge,
            height: options.thumbEdge,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 72, effort: WEBP_EFFORT })
          .toBuffer()
      : Promise.resolve(undefined),
  ]);
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
    thumb,
  };
}
