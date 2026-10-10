import { getSupabasePublicConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

import type { Rotation } from "./shared";

/**
 * Browser half of the upload chain (ADR-0071): decode a photo, re-encode it, and write it
 * straight to Storage with a progress callback. Nothing here runs on the server.
 *
 * Re-encoding through a canvas is not only about weight. A canvas holds pixels and nothing
 * else, so what comes out of it carries no EXIF block: no GPS position of the kitchen where a
 * parent photographed a page, no phone model. Every photo goes through it, small ones included
 * — the previous compressor returned files under 600 Ko untouched, metadata and all.
 */

export class UploadError extends Error {
  constructor(
    public readonly reason: "type" | "tooLarge" | "forbidden" | "network" | "auth" | "failed",
  ) {
    super(reason);
    this.name = "UploadError";
  }
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Safari decodes HEIC in an <img> long before it does through createImageBitmap.
    }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new UploadError("type");
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

function draw(
  decoded: Decoded,
  maxEdge: number,
  rotation: Rotation,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
  const w = Math.max(1, Math.round(decoded.width * scale));
  const h = Math.max(1, Math.round(decoded.height * scale));
  const quarter = rotation === 90 || rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = quarter ? h : w;
  canvas.height = quarter ? w : h;
  const context = canvas.getContext("2d");
  if (!context) throw new UploadError("type");
  // A transparent PNG would come out of a JPEG encoder black where it was clear.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(decoded.source, -w / 2, -h / 2, w, h);
  return { canvas, width: canvas.width, height: canvas.height };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new UploadError("type"))),
      type,
      quality,
    ),
  );
}

function averageColor(canvas: HTMLCanvasElement): string | undefined {
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const context = probe.getContext("2d");
  if (!context) return undefined;
  context.drawImage(canvas, 0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export type PreparedImage = {
  file: File;
  width: number;
  height: number;
  thumb?: File;
  color?: string;
};

/**
 * One photo, ready to send: oriented, at most `maxEdge` pixels on its long side, JPEG, without
 * metadata. `thumbEdge` adds a light rendition for lists (messages make their own; class media
 * get theirs from the server, which normalises them again).
 */
export async function prepareImage(
  file: File,
  options: { maxEdge: number; quality?: number; thumbEdge?: number; rotation?: Rotation },
): Promise<PreparedImage> {
  const decoded = await decode(file);
  try {
    const main = draw(decoded, options.maxEdge, options.rotation ?? 0);
    const blob = await toBlob(main.canvas, "image/jpeg", options.quality ?? 0.88);
    const name = `${file.name.replace(/\.[^.]*$/, "") || "photo"}.jpg`;
    const result: PreparedImage = {
      file: new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified }),
      width: main.width,
      height: main.height,
      color: averageColor(main.canvas),
    };
    if (options.thumbEdge) {
      const small = draw(
        { ...decoded, source: main.canvas, width: main.width, height: main.height },
        options.thumbEdge,
        0,
      );
      const thumb = await toBlob(small.canvas, "image/jpeg", 0.74);
      result.thumb = new File([thumb], `thumb-${name}`, { type: "image/jpeg" });
    }
    return result;
  } finally {
    decoded.release();
  }
}

/** True for what a browser may decode into a photo, HEIC included where the platform can. */
export function looksLikeImage(file: File): boolean {
  return file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
}

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/**
 * Writes a file to a private bucket as the signed-in reader, reporting progress.
 *
 * supabase-js has no upload progress; a page photographed on a slow connection takes several
 * seconds, and a frozen thumbnail during that time reads as a failure. The request is the one
 * supabase-js makes, through XMLHttpRequest for its `upload.onprogress`; the Storage policies
 * decide exactly as they do for supabase-js.
 */
export async function uploadFile(options: {
  bucket: "class-media" | "messages";
  path: string;
  file: Blob;
  contentType: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new UploadError("auth");
  const { url, anonKey } = getSupabasePublicConfig();

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${url}/storage/v1/object/${options.bucket}/${options.path}`);
    request.setRequestHeader("authorization", `Bearer ${session.access_token}`);
    request.setRequestHeader("apikey", anonKey);
    request.setRequestHeader("x-upsert", "false");
    request.setRequestHeader("cache-control", "max-age=3600");
    request.setRequestHeader("content-type", options.contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        options.onProgress?.(1);
        resolve();
        return;
      }
      reject(new UploadError(classify(request.status, request.responseText)));
    };
    request.onerror = () => reject(new UploadError("network"));
    request.onabort = () => reject(new UploadError("network"));
    options.signal?.addEventListener("abort", () => request.abort(), { once: true });
    request.send(options.file);
  });
}

function classify(status: number, body: string): UploadError["reason"] {
  const text = body.toLowerCase();
  if (status === 413 || text.includes("maximum allowed size") || text.includes("too large"))
    return "tooLarge";
  if (status === 415 || text.includes("mime type")) return "type";
  if (status === 401) return "auth";
  if (status === 403 || text.includes("row-level security") || text.includes("unauthorized"))
    return "forbidden";
  return "failed";
}

/** Removes files the reader uploaded and then took back; failures are left to the sweep. */
export async function removeUploaded(bucket: "class-media" | "messages", paths: string[]) {
  if (paths.length === 0) return;
  try {
    await createClient().storage.from(bucket).remove(paths);
  } catch {
    // ops:storage-sweep removes what no row references, after 24 hours.
  }
}
