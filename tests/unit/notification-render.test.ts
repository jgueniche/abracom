import { describe, expect, it } from "vitest";

import { defaultChannels, groupOf, parseQuietHours } from "@/lib/notifications/kinds";
import { hrefFor, renderNotification } from "@/lib/notifications/render";

const t = (key: string, values?: Record<string, unknown>) =>
  `${key}${values ? ":" + Object.values(values).join(",") : ""}`;

describe("notification kinds", () => {
  it("maps kinds to preference groups", () => {
    expect(groupOf("announcement.reminder")).toBe("announcement");
    expect(groupOf("class_post.new")).toBe("class");
    expect(groupOf("note.new")).toBe("class");
    expect(groupOf("report.new")).toBe("moderation");
    expect(groupOf("weird")).toBe("other");
  });

  it("never e-mails messages one by one", () => {
    expect(defaultChannels("message")).toEqual({ push: true, email: false, digest: true });
    expect(defaultChannels("event").email).toBe(true);
  });

  it("validates quiet hours", () => {
    expect(parseQuietHours({ start: "21:00", end: "07:00" })).toEqual({
      start: "21:00",
      end: "07:00",
    });
    expect(parseQuietHours({ start: "25:00", end: "07:00" })).toBeNull();
    expect(parseQuietHours(null)).toBeNull();
  });
});

describe("renderNotification", () => {
  it("links each kind to the right screen", () => {
    expect(hrefFor("announcement.new", { announcement_id: "a1" })).toBe("/annonces/a1");
    expect(hrefFor("class_post.new", { class_id: "c1", type: "homework" })).toBe(
      "/classes/c1/devoirs",
    );
    expect(hrefFor("note.new", { class_id: "c1" })).toBe("/classes/c1/mots");
    expect(hrefFor("message.new", { thread_id: "t1" })).toBe("/messages/t1");
    expect(hrefFor("event.reminder", { event_id: "e1" })).toBe("/agenda/e1");
    expect(hrefFor("absence.new", { class_id: "c1" })).toBe("/classes/c1/absences");
    expect(hrefFor("report.new", {})).toBe("/admin/signalements");
    expect(hrefFor("unknown", {})).toBe("/notifications");
  });

  it("renders titles and bodies from the payload", () => {
    expect(
      renderNotification(
        "message.new",
        { author_name: "Léa", preview: "Salut", thread_id: "t1" },
        t,
      ),
    ).toEqual({
      title: "messageNew:Léa",
      body: "Salut",
      href: "/messages/t1",
    });
    expect(
      renderNotification(
        "class_post.new",
        { class_name: "PS", type: "homework", title: "Poésie", class_id: "c1" },
        t,
      ).title,
    ).toBe("homeworkNew:PS");
    expect(
      renderNotification("document.new", { title: "Charte", requires_signature: true }, t).title,
    ).toBe("documentToSign:Charte");
    expect(
      renderNotification("absence.reviewed", { student_name: "Noa", status: "justified" }, t).title,
    ).toBe("absenceJustified:Noa");
    expect(renderNotification("what.ever", {}, t).title).toBe("default");
  });
});
