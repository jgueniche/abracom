"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  isPdf,
  looksLikeImage,
  prepareImage,
  removeUploaded,
  UploadError,
  uploadFile,
} from "@/lib/uploads/browser";
import {
  type ClassUpload,
  type MessageUpload,
  PDF_TYPE,
  type Rotation,
  storageName,
} from "@/lib/uploads/shared";

export type UploadItem = {
  id: string;
  name: string;
  kind: "image" | "pdf";
  status: "preparing" | "uploading" | "done" | "error";
  progress: number;
  error?: UploadError["reason"];
  /** A local preview, before anything has left the device. */
  previewUrl?: string;
  /** A quarter turn the server applies when it normalises the page (class media only). */
  rotation: Rotation;
  path?: string;
  thumbPath?: string;
  size?: number;
  width?: number;
  height?: number;
  color?: string;
};

export type UploadOptions = {
  bucket: "class-media" | "messages";
  /** `{school}/{class}/{post}` or `{school}/{thread}` — the convention the policies read. */
  folder: string;
  maxFiles: number;
  maxPdfBytes: number;
  allowPdf: boolean;
  image: { maxEdge: number; quality?: number; thumbEdge?: number };
  /**
   * Class media are normalised again by the server at publication (ADR-0019): the browser
   * writes an `.upload.jpg` original that the publishing action turns into WebP and removes.
   */
  normalisedByServer: boolean;
};

export type Refusal = "count" | "type" | "tooLarge";

/** A photo bigger than this is not a photo a phone takes; refuse it before decoding. */
const MAX_IMAGE_INPUT_BYTES = 40 * 1024 * 1024;

/**
 * The upload queue behind every place a person joins a file: a homework's pages, the photos of
 * the cahier de vie, a message. A file starts its journey the moment it is chosen — a teacher
 * types the title while the page travels — and each one carries its own state, so one failure
 * is retried alone instead of failing the form.
 *
 * Decoding is done one photo at a time: ten twelve-megapixel bitmaps decoded at once are half a
 * gigabyte, which is how a phone's browser tab dies. The uploads themselves run side by side.
 */
export function useUploads(options: UploadOptions) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const files = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  const decoding = useRef<Promise<unknown>>(Promise.resolve());

  const patch = useCallback((id: string, change: Partial<UploadItem>) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }, []);

  const run = useCallback(
    async (id: string) => {
      const file = files.current.get(id);
      const item = itemsRef.current.find((entry) => entry.id === id);
      if (!file || !item) return;
      const { bucket, folder, image, normalisedByServer } = optionsRef.current;
      const controller = new AbortController();
      controllers.current.set(id, controller);
      try {
        if (item.kind === "pdf") {
          const path = `${folder}/${storageName(file.name, "pdf")}`;
          patch(id, { status: "uploading", progress: 0, error: undefined });
          await uploadFile({
            bucket,
            path,
            file,
            contentType: PDF_TYPE,
            onProgress: (progress) => patch(id, { progress }),
            signal: controller.signal,
          });
          patch(id, { status: "done", progress: 1, path, size: file.size });
          return;
        }

        patch(id, { status: "preparing", progress: 0, error: undefined });
        const job = decoding.current.then(() =>
          prepareImage(file, {
            maxEdge: image.maxEdge,
            quality: image.quality,
            thumbEdge: image.thumbEdge,
          }),
        );
        decoding.current = job.catch(() => undefined);
        const prepared = await job;
        if (controller.signal.aborted) return;

        const name = storageName(file.name, normalisedByServer ? "upload.jpg" : "jpg");
        const path = `${folder}/${name}`;
        const thumbPath = prepared.thumb ? path.replace(/\.jpg$/, ".thumb.jpg") : undefined;
        // The preview becomes exactly what is sent — and a HEIC photo, which Chrome cannot
        // show, appears once the conversion is done.
        const previous = itemsRef.current.find((entry) => entry.id === id)?.previewUrl;
        if (previous) URL.revokeObjectURL(previous);
        patch(id, {
          status: "uploading",
          progress: 0,
          width: prepared.width,
          height: prepared.height,
          color: prepared.color,
          previewUrl: URL.createObjectURL(prepared.file),
        });
        await Promise.all([
          uploadFile({
            bucket,
            path,
            file: prepared.file,
            contentType: "image/jpeg",
            onProgress: (progress) => patch(id, { progress: progress * 0.95 }),
            signal: controller.signal,
          }),
          prepared.thumb && thumbPath
            ? uploadFile({
                bucket,
                path: thumbPath,
                file: prepared.thumb,
                contentType: "image/jpeg",
                signal: controller.signal,
              })
            : Promise.resolve(),
        ]);
        patch(id, { status: "done", progress: 1, path, thumbPath, size: prepared.file.size });
      } catch (error) {
        if (controller.signal.aborted) return;
        patch(id, {
          status: "error",
          error: error instanceof UploadError ? error.reason : "failed",
        });
      } finally {
        controllers.current.delete(id);
      }
    },
    [patch],
  );

  const add = useCallback(
    (incoming: FileList | readonly File[] | null) => {
      if (!incoming) return;
      const { maxFiles, maxPdfBytes, allowPdf } = optionsRef.current;
      let room = maxFiles - itemsRef.current.length;
      let refused: Refusal | null = null;
      const accepted: UploadItem[] = [];
      for (const file of Array.from(incoming)) {
        const kind = isPdf(file) ? "pdf" : looksLikeImage(file) ? "image" : null;
        if (!kind || (kind === "pdf" && !allowPdf)) {
          refused = "type";
          continue;
        }
        if (
          (kind === "pdf" && file.size > maxPdfBytes) ||
          (kind === "image" && file.size > MAX_IMAGE_INPUT_BYTES)
        ) {
          refused = "tooLarge";
          continue;
        }
        if (room <= 0) {
          refused = "count";
          continue;
        }
        room--;
        const id = globalThis.crypto.randomUUID();
        files.current.set(id, file);
        accepted.push({
          id,
          name: file.name || (kind === "pdf" ? "document.pdf" : "photo.jpg"),
          kind,
          status: kind === "image" ? "preparing" : "uploading",
          progress: 0,
          rotation: 0,
          previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
          size: file.size,
        });
      }
      setRefusal(refused);
      if (accepted.length === 0) return;
      itemsRef.current = [...itemsRef.current, ...accepted];
      setItems(itemsRef.current);
      for (const item of accepted) void run(item.id);
    },
    [run],
  );

  const remove = useCallback((id: string) => {
    const item = itemsRef.current.find((entry) => entry.id === id);
    controllers.current.get(id)?.abort();
    files.current.delete(id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    const uploaded = [item?.path, item?.thumbPath].filter((path): path is string => !!path);
    if (uploaded.length > 0) void removeUploaded(optionsRef.current.bucket, uploaded);
    itemsRef.current = itemsRef.current.filter((entry) => entry.id !== id);
    setItems(itemsRef.current);
  }, []);

  const rotate = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((entry) => entry.id === id);
      if (!item) return;
      patch(id, { rotation: ((item.rotation + 90) % 360) as Rotation });
    },
    [patch],
  );

  const retry = useCallback((id: string) => void run(id), [run]);

  const move = useCallback((id: string, offset: -1 | 1) => {
    const list = [...itemsRef.current];
    const index = list.findIndex((entry) => entry.id === id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target]!, list[index]!];
    itemsRef.current = list;
    setItems(list);
  }, []);

  /** After a successful send: the files now belong to a message or a post, keep them. */
  const reset = useCallback(() => {
    for (const item of itemsRef.current) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    files.current.clear();
    itemsRef.current = [];
    setItems([]);
    setRefusal(null);
  }, []);

  useEffect(() => {
    const running = controllers.current;
    return () => {
      for (const controller of running.values()) controller.abort();
      for (const item of itemsRef.current)
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  const busy = items.some((item) => item.status === "preparing" || item.status === "uploading");
  const failed = items.some((item) => item.status === "error");

  const classUploads = useMemo<ClassUpload[]>(
    () =>
      items
        .filter((item) => item.status === "done" && item.path)
        .map((item) => ({
          path: item.path!,
          kind: item.kind,
          name: item.name.slice(0, 200),
          rotation: item.rotation,
        })),
    [items],
  );

  const messageUploads = useMemo<MessageUpload[]>(
    () =>
      items
        .filter((item) => item.status === "done" && item.path)
        .map((item) => ({
          path: item.path!,
          name:
            (item.kind === "image" ? item.name.replace(/\.[^.]*$/, "") + ".jpg" : item.name)
              .slice(0, 120)
              .trim() || "fichier",
          mime: item.kind === "pdf" ? PDF_TYPE : "image/jpeg",
          size: item.size ?? 0,
          width: item.width,
          height: item.height,
          thumb: item.thumbPath,
          color: item.color,
        })),
    [items],
  );

  return {
    items,
    add,
    remove,
    rotate,
    retry,
    move,
    reset,
    busy,
    failed,
    refusal,
    clearRefusal: () => setRefusal(null),
    classUploads,
    messageUploads,
  };
}
