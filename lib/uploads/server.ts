import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { processImage, THUMB_EDGE } from "@/lib/media";
import { BUCKETS } from "@/lib/storage";
import type { Database } from "@/lib/supabase/database.types";
import type { TablesInsert } from "@/lib/supabase/types";

import {
  type ClassUpload,
  isFileInFolder,
  isPendingOriginal,
  PDF_TYPE,
  stemOf,
  UPLOAD_LIMITS,
} from "./shared";

/**
 * Server half of the upload chain (ADR-0071). The browser has written the files into the class
 * folder; this checks each one against what it claims to be, normalises the photos (ADR-0019:
 * orientation, size, WebP re-encoding, which drops every metadata block) and writes the light
 * rendition the lists display. It runs in the publishing actions only — the one place that may
 * carry `sharp` (ADR-0066).
 */

export class UploadRejected extends Error {
  constructor(public readonly reason: "path" | "missing" | "type" | "tooLarge" | "process") {
    super(reason);
    this.name = "UploadRejected";
  }
}

export type StoredMedia = Omit<TablesInsert<"class_post_media">, "post_id" | "sort_order">;

type Client = SupabaseClient<Database>;

/** Runs `task` over `items`, at most `limit` at a time, and keeps every outcome. */
async function settleAll<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await task(items[index]!) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Turns what the browser uploaded into `class_post_media` rows, in the order given. Either every
 * file is accepted, or none is: what this call wrote is removed again and the first refusal is
 * thrown, so a half-published homework never shows two pages out of three.
 */
export async function finalizeClassUploads(
  supabase: Client,
  folder: string,
  uploads: readonly ClassUpload[],
  options: { maxEdge: number },
): Promise<StoredMedia[]> {
  const written: string[] = [];
  const originals: string[] = [];
  const bucket = supabase.storage.from(BUCKETS.classMedia);

  const outcomes = await settleAll(uploads, 3, async (upload): Promise<StoredMedia> => {
    if (!isFileInFolder(upload.path, folder)) throw new UploadRejected("path");

    if (upload.kind === "pdf") {
      const { data, error } = await bucket.info(upload.path);
      if (error || !data) throw new UploadRejected("missing");
      if (data.contentType !== PDF_TYPE) throw new UploadRejected("type");
      const size = data.size ?? 0;
      if (size > UPLOAD_LIMITS.classMedia.maxPdfBytes) throw new UploadRejected("tooLarge");
      return {
        storage_path: upload.path,
        kind: "pdf",
        filename: upload.name,
        size_bytes: size,
      };
    }

    // A photo is only ever taken from an original the browser has just written: never from a
    // file already published, which would let one request re-point another post's page.
    if (!isPendingOriginal(upload.path)) throw new UploadRejected("path");
    const { data: blob, error } = await bucket.download(upload.path);
    if (error || !blob) throw new UploadRejected("missing");

    let image: Awaited<ReturnType<typeof processImage>>;
    try {
      image = await processImage(Buffer.from(await blob.arrayBuffer()), {
        maxEdge: options.maxEdge,
        rotate: upload.rotation,
        thumbEdge: THUMB_EDGE,
      });
    } catch {
      throw new UploadRejected("type");
    }

    const stem = stemOf(upload.path);
    const main = `${stem}.webp`;
    const thumb = `${stem}.thumb.webp`;
    const [mainResult, thumbResult] = await Promise.all([
      bucket.upload(main, image.buffer, { contentType: image.contentType, upsert: true }),
      image.thumb
        ? bucket.upload(thumb, image.thumb, { contentType: "image/webp", upsert: true })
        : Promise.resolve({ error: null }),
    ]);
    if (!mainResult.error) written.push(main);
    if (image.thumb && !thumbResult.error) written.push(thumb);
    if (mainResult.error) throw new UploadRejected("process");

    originals.push(upload.path);
    return {
      storage_path: main,
      thumb_path: image.thumb && !thumbResult.error ? thumb : null,
      kind: "image",
      width: image.width,
      height: image.height,
      blurhash: image.blurhash,
      filename: upload.name,
      size_bytes: image.buffer.length,
    };
  });

  const refused = outcomes.find((outcome) => outcome.status === "rejected");
  if (refused) {
    // The originals stay where they are, so that publishing again simply works.
    if (written.length > 0) await bucket.remove(written);
    const reason = (refused as PromiseRejectedResult).reason;
    throw reason instanceof UploadRejected ? reason : new UploadRejected("process");
  }
  // Every original has served its purpose; if removing one fails, the sweep will.
  if (originals.length > 0) await bucket.remove(originals);
  return outcomes.map((outcome) => (outcome as PromiseFulfilledResult<StoredMedia>).value);
}
