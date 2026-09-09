import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export const BUCKETS = {
  attachments: "attachments",
  documents: "documents",
  classMedia: "class-media",
  avatars: "avatars",
  justifications: "justifications",
} as const;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const SIGNED_URL_TTL_SECONDS = 10 * 60;

export const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

/** Keeps a readable, URL-safe file name and avoids collisions. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "fichier";
  const cleaned = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const stamp = Date.now().toString(36);
  return `${stamp}-${cleaned || "fichier"}`;
}

/** attachments/{school_id}/{announcement_id}/{file} — matches the storage RLS convention. */
export function attachmentPath(schoolId: string, announcementId: string, fileName: string): string {
  return `${schoolId}/${announcementId}/${safeFileName(fileName)}`;
}

/** documents/{school_id}/{document_id}/{file} */
export function documentPath(schoolId: string, documentId: string, fileName: string): string {
  return `${schoolId}/${documentId}/${safeFileName(fileName)}`;
}

export async function createSignedUrl(
  supabase: SupabaseClient<Database>,
  bucket: string,
  path: string,
  download?: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, download ? { download } : undefined);
  if (error) {
    console.warn("[storage] signed url:", error.message);
    return null;
  }
  return data.signedUrl;
}
