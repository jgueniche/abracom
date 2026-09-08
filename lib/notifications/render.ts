import type { NotificationKind } from "./kinds";

/** What a notification looks like once rendered for the bell, a push message or an e-mail. */
export type RenderedNotification = {
  title: string;
  body: string | null;
  href: string;
};

/** Minimal translator contract so the renderer works with next-intl on the server and the client. */
export type Translate = (key: string, values?: Record<string, string | number | Date>) => string;

const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value.trim() !== "" ? value : fallback;

export function hrefFor(kind: string, payload: Record<string, unknown>): string {
  if (kind.startsWith("announcement.") && typeof payload.announcement_id === "string") {
    return `/annonces/${payload.announcement_id}`;
  }
  if (kind.startsWith("document.")) return "/documents";
  if (kind === "class_post.new" && typeof payload.class_id === "string") {
    const section =
      payload.type === "homework" ? "/devoirs" : payload.type === "journal" ? "/cahier" : "";
    return `/classes/${payload.class_id}${section}`;
  }
  if (kind === "note.new" && typeof payload.class_id === "string") {
    return `/classes/${payload.class_id}/mots`;
  }
  if (kind.startsWith("message.") && typeof payload.thread_id === "string") {
    return `/messages/${payload.thread_id}`;
  }
  if (kind.startsWith("event.") && typeof payload.event_id === "string") {
    return `/agenda/${payload.event_id}`;
  }
  if (kind.startsWith("absence.") && typeof payload.class_id === "string") {
    return `/classes/${payload.class_id}/absences`;
  }
  if (kind.startsWith("report.")) return "/admin/signalements";
  return "/notifications";
}

/** `t` is scoped to the `notifications.kinds` namespace. */
export function renderNotification(
  kind: string,
  payload: Record<string, unknown>,
  t: Translate,
): RenderedNotification {
  const href = hrefFor(kind, payload);
  const title = text(payload.title);
  switch (kind as NotificationKind) {
    case "announcement.new":
      return { title: t("announcementNew", { title }), body: null, href };
    case "announcement.reminder":
      return { title: t("announcementReminder", { title }), body: null, href };
    case "document.new":
      return {
        title: t(payload.requires_signature ? "documentToSign" : "documentNew", { title }),
        body: null,
        href,
      };
    case "class_post.new":
      return {
        title: t(payload.type === "homework" ? "homeworkNew" : "classPostNew", {
          className: text(payload.class_name),
        }),
        body: title || null,
        href,
      };
    case "note.new":
      return { title: t("noteNew", { student: text(payload.student_name) }), body: null, href };
    case "message.new":
      return {
        title: text(payload.thread_title)
          ? t("messageNewIn", {
              author: text(payload.author_name),
              thread: text(payload.thread_title),
            })
          : t("messageNew", { author: text(payload.author_name) }),
        body: text(payload.preview) || null,
        href,
      };
    case "event.new":
      return { title: t("eventNew", { title }), body: null, href };
    case "event.reminder":
      return {
        title: t("eventReminder", { title, days: Number(payload.days ?? 1) }),
        body: null,
        href,
      };
    case "event.confirmed":
      return { title: t("eventConfirmed", { title }), body: null, href };
    case "absence.new":
      return { title: t("absenceNew", { student: text(payload.student_name) }), body: null, href };
    case "absence.reviewed":
      return {
        title: t(payload.status === "justified" ? "absenceJustified" : "absenceUnjustified", {
          student: text(payload.student_name),
        }),
        body: null,
        href,
      };
    case "report.new":
      return { title: t("reportNew"), body: null, href };
    default:
      return { title: t("default"), body: null, href };
  }
}
