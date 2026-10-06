import { z } from "zod";

/**
 * What travels between the browser, which writes a file straight to Storage, and the Server
 * Action, which only ever receives a description of it (ADR-0071).
 *
 * Files never go through a Server Action body any more: Next caps it at 1 MB and Vercel at
 * 4.5 MB, while a photo taken with a phone weighs 3 to 5 MB — sending one in a parents' group
 * crashed the whole conversation screen. The browser now uploads to the private bucket under
 * the same Storage policies as before, and the action checks what it is told against what is
 * actually stored.
 */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PDF_TYPE = "application/pdf";

/**
 * The long edge each kind of picture is kept at. A page joined to a homework is printed: 2 400 px
 * is about 200 dpi on an A4 sheet, where 1 600 px — the cahier de vie's size — gave 137 and a
 * photographed page of a revision book printed as a smudge. A message photo is read on a screen.
 */
export const IMAGE_EDGES = { page: 2400, photo: 1600, message: 2048, thumb: 640 } as const;

export const UPLOAD_LIMITS = {
  /** A homework's pages and worksheets, a cahier de vie's photos. */
  classMedia: { maxFiles: 10, maxPdfBytes: 20 * 1024 * 1024 },
  /** The photos of a message. The `messages` bucket refuses anything above 10 MB. */
  messages: { maxFiles: 6, maxPdfBytes: 10 * 1024 * 1024 },
} as const;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** A file name as `storageName` writes it: no slash, nothing to escape in a URL. */
const NAME = "[A-Za-z0-9][A-Za-z0-9._-]{0,159}";

export const uuidRegex = new RegExp(`^${UUID}$`, "i");

/** `class-media/{school}/{class}/{post}` — the convention the Storage policies read. */
export function classMediaFolder(schoolId: string, classId: string, postId: string): string {
  return `${schoolId}/${classId}/${postId}`;
}

/** `messages/{school}/{thread}` */
export function messageFolder(schoolId: string, threadId: string): string {
  return `${schoolId}/${threadId}`;
}

/** True when `path` names a file directly inside `folder`, and nothing cleverer. */
export function isFileInFolder(path: string, folder: string): boolean {
  if (!new RegExp(`^${UUID}(/${UUID}){1,2}$`, "i").test(folder)) return false;
  if (!path.startsWith(`${folder}/`)) return false;
  return new RegExp(`^${NAME}$`).test(path.slice(folder.length + 1));
}

/** Class media paths as the redirect route accepts them: school / class / post / file. */
export const CLASS_MEDIA_PATH = new RegExp(`^${UUID}/${UUID}/${UUID}/${NAME}$`, "i");
/** Message attachment paths: school / thread / file. */
export const MESSAGE_PATH = new RegExp(`^${UUID}/${UUID}/${NAME}$`, "i");

/**
 * A readable, URL-safe and unique storage name: `k3x9f2a-q7-page-12.jpg`. The stamp and the
 * random part keep two pages called `IMG_0001.jpg` apart; the slug keeps the folder legible.
 */
export function storageName(original: string, extension?: string, random = randomPart()): string {
  const base = (original.split(/[\\/]/).pop() ?? "fichier").replace(/\.[^.]*$/, "");
  const slug =
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 48) || "fichier";
  const ext = (extension ?? original.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? "bin").toLowerCase();
  return `${Date.now().toString(36)}-${random}-${slug}.${ext}`;
}

function randomPart(): string {
  const bytes = new Uint8Array(3);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 5);
}

/** The original of an uploaded photo, waiting for the server to normalise it. */
export function isPendingOriginal(path: string): boolean {
  return /\.upload\.[a-z0-9]+$/i.test(path);
}

/** `…/k3x-page.upload.jpg` → `…/k3x-page` — the stem the normalised files are written under. */
export function stemOf(path: string): string {
  return path.replace(/(\.upload)?\.[A-Za-z0-9]+$/, "");
}

export const rotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);
export type Rotation = z.infer<typeof rotationSchema>;

/** A file the browser put into a class folder, described to the publishing action. */
export const classUploadSchema = z.object({
  path: z.string().max(400),
  kind: z.enum(["image", "pdf"]),
  name: z.string().trim().min(1).max(200),
  rotation: rotationSchema.default(0),
});
export type ClassUpload = z.infer<typeof classUploadSchema>;

/** A file the browser put into a thread folder, described to `sendMessage`. */
export const messageUploadSchema = z.object({
  path: z.string().max(400),
  name: z.string().trim().min(1).max(120),
  mime: z.enum([...IMAGE_TYPES, PDF_TYPE]),
  size: z.number().int().nonnegative(),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  thumb: z.string().max(400).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
});
export type MessageUpload = z.infer<typeof messageUploadSchema>;

/** Parses the JSON a form carries in a hidden field; anything malformed is an empty list. */
export function parseUploadList<T>(raw: FormDataEntryValue | null, schema: z.ZodType<T>): T[] {
  if (typeof raw !== "string" || raw === "") return [];
  try {
    const parsed = z.array(schema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** "240 Ko", "3,2 Mo" — the way a family reads a file size. */
export function formatBytes(bytes: number, locale = "fr"): string {
  const units = locale.startsWith("fr") ? ["o", "Ko", "Mo", "Go"] : ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

export function isImageType(mime: string): boolean {
  return (IMAGE_TYPES as readonly string[]).includes(mime);
}
