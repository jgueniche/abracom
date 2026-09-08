/**
 * Notification kinds and preference groups (mirror of `notification_group()` in SQL).
 * Channel preferences are stored per group; quiet hours and Shabbat mode under the `*` row.
 */
export const NOTIFICATION_GROUPS = [
  "announcement",
  "document",
  "class",
  "message",
  "event",
  "absence",
  "moderation",
  "community",
] as const;
export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];

export type NotificationKind =
  | "announcement.new"
  | "announcement.reminder"
  | "document.new"
  | "class_post.new"
  | "note.new"
  | "message.new"
  | "event.new"
  | "event.reminder"
  | "event.confirmed"
  | "absence.new"
  | "absence.reviewed"
  | "report.new";

export function groupOf(kind: string): NotificationGroup | "other" {
  if (kind.startsWith("announcement.")) return "announcement";
  if (kind.startsWith("document.")) return "document";
  if (kind.startsWith("class_post.") || kind.startsWith("note.")) return "class";
  if (kind.startsWith("message.")) return "message";
  if (kind.startsWith("event.")) return "event";
  if (kind.startsWith("absence.")) return "absence";
  if (kind.startsWith("report.")) return "moderation";
  if (kind.startsWith("community.")) return "community";
  return "other";
}

export type QuietHours = { start: string; end: string };

export const DEFAULT_QUIET_HOURS: QuietHours = { start: "21:00", end: "07:00" };

export type ChannelPreference = { push: boolean; email: boolean; digest: boolean };

/** Messages are never e-mailed one by one (brief §7.8): digest + push only. */
export function defaultChannels(group: NotificationGroup): ChannelPreference {
  return { push: true, email: group !== "message", digest: true };
}

export function parseQuietHours(value: unknown): QuietHours | null {
  if (!value || typeof value !== "object") return null;
  const { start, end } = value as { start?: unknown; end?: unknown };
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (typeof start !== "string" || typeof end !== "string") return null;
  if (!time.test(start) || !time.test(end)) return null;
  return { start, end };
}
