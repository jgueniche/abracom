export type MessageAttachment = {
  path: string;
  name: string;
  size: number;
  mime: string;
  /** Photos sent since session 33 carry their size and a light rendition (ADR-0071). */
  width?: number;
  height?: number;
  thumb?: string;
  color?: string;
};

/** Splits a message body into text and `@Mention` segments matching known member names. */
export function segmentMentions(
  body: string,
  memberNames: readonly string[],
): Array<{ text: string; mention: boolean }> {
  if (memberNames.length === 0 || !body.includes("@")) return [{ text: body, mention: false }];
  const names = [...memberNames].filter(Boolean).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`@(${names.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`, "gu");
  const segments: Array<{ text: string; mention: boolean }> = [];
  let last = 0;
  for (const match of body.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: body.slice(last, index), mention: false });
    segments.push({ text: match[0], mention: true });
    last = index + match[0].length;
  }
  if (last < body.length) segments.push({ text: body.slice(last), mention: false });
  return segments.length ? segments : [{ text: body, mention: false }];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Local-date key used to insert day separators in a conversation. */
export function dayKey(iso: string, timeZone = "Europe/Paris"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function parseAttachments(value: unknown): MessageAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): MessageAttachment[] => {
    if (typeof item !== "object" || item === null) return [];
    const raw = item as Record<string, unknown>;
    if (typeof raw.path !== "string" || typeof raw.name !== "string") return [];
    const positive = (n: unknown) =>
      typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
    return [
      {
        path: raw.path,
        name: raw.name,
        size: typeof raw.size === "number" ? raw.size : 0,
        mime: typeof raw.mime === "string" ? raw.mime : "",
        width: positive(raw.width),
        height: positive(raw.height),
        thumb: typeof raw.thumb === "string" ? raw.thumb : undefined,
        color:
          typeof raw.color === "string" && /^#[0-9a-f]{6}$/i.test(raw.color)
            ? raw.color
            : undefined,
      },
    ];
  });
}

/** A photo, as opposed to a document: shown in the conversation rather than linked. */
export function isPhoto(attachment: MessageAttachment): boolean {
  return /^image\/(jpeg|png|webp)$/.test(attachment.mime);
}

export const REACTION_EMOJIS = ["👍", "❤️", "🙏", "😊", "🎉"] as const;
