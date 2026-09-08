import "server-only";

import { getTranslations } from "next-intl/server";

import { appName, publicEnv } from "@/lib/env";
import { locationFor } from "@/lib/hebcal";
import {
  type EmailItem,
  type EmailSender,
  isEmailConfigured,
  renderEmail,
  sendWithResend,
} from "@/lib/notifications/email";
import { parseQuietHours } from "@/lib/notifications/kinds";
import { isPushConfigured, sendPush } from "@/lib/notifications/push";
import { renderNotification, type Translate } from "@/lib/notifications/render";
import { nextAllowedTime } from "@/lib/notifications/schedule";
import { createAdminClient } from "@/lib/supabase/admin";

export type JobTask = "dispatch" | "digest" | "reminders";
export const JOB_TASKS: JobTask[] = ["dispatch", "digest", "reminders"];

export type JobReport = {
  task: JobTask;
  processed: number;
  sent: number;
  deferred: number;
  failed: number;
  skipped: number;
};

type JobOptions = { now?: Date; sendEmail?: EmailSender };

async function translator(locale: "fr" | "en", namespace: string): Promise<Translate> {
  const t = await getTranslations({ locale, namespace });
  return (key, values) => t(key as never, values as never);
}

/**
 * Delivery worker (brief §7.8). `dispatch` sends due push / e-mail deliveries and postpones the
 * ones falling on Shabbat / yom tov or in the user's quiet hours; `digest` e-mails the unread
 * notifications of the day; `reminders` queues the J-7 / J-1 event reminders.
 */
export async function runNotificationJob(
  task: JobTask,
  options: JobOptions = {},
): Promise<JobReport> {
  const now = options.now ?? new Date();
  const report: JobReport = { task, processed: 0, sent: 0, deferred: 0, failed: 0, skipped: 0 };
  const admin = createAdminClient();
  const sendEmail = options.sendEmail ?? sendWithResend;
  const site = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  if (task === "reminders") {
    const [events, birthdays] = await Promise.all([
      admin.rpc("queue_event_reminders"),
      admin.rpc("queue_birthday_reminders"),
    ]);
    if (events.error) throw events.error;
    if (birthdays.error) throw birthdays.error;
    report.processed = (events.data ?? 0) + (birthdays.data ?? 0);
    return report;
  }

  if (task === "digest") {
    const since = new Date(now.getTime() - 48 * 3_600_000).toISOString();
    const { data, error } = await admin.rpc("digest_candidates", { since });
    if (error) throw error;
    const byUser = new Map<string, typeof data>();
    for (const row of data ?? []) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(row);
      byUser.set(row.user_id, list);
    }
    for (const rows of byUser.values()) {
      const first = rows[0]!;
      report.processed += rows.length;
      const policy = {
        quietHours: parseQuietHours(first.quiet_hours),
        shabbatMode: first.shabbat_mode,
      };
      const location = locationFor({
        latitude: first.latitude,
        longitude: first.longitude,
        timezone: first.timezone,
      });
      if (!first.email || !isEmailConfigured() || nextAllowedTime(now, policy, location) > now) {
        report.skipped += rows.length;
        continue;
      }
      const locale = first.locale === "en" ? "en" : "fr";
      const [tk, te] = await Promise.all([
        translator(locale, "notifications.kinds"),
        translator(locale, "emails"),
      ]);
      const items: EmailItem[] = rows.map((row) => {
        const rendered = renderNotification(
          row.kind,
          (row.payload ?? {}) as Record<string, unknown>,
          tk,
        );
        return { ...rendered, href: `${site}${rendered.href}` };
      });
      const { html, text } = renderEmail({
        greeting: te("greeting", { name: first.first_name }),
        intro: te("digestIntro", { count: rows.length }),
        items,
        cta: { label: te("open"), href: `${site}/notifications` },
        footer: te("footer", { app: appName, url: `${site}/notifications/preferences` }),
      });
      try {
        await sendEmail({
          to: first.email,
          subject: te("digestSubject", { app: appName, count: rows.length }),
          html,
          text,
        });
        await admin
          .from("notifications")
          .update({ digested_at: now.toISOString() })
          .in(
            "id",
            rows.map((r) => r.notification_id),
          );
        report.sent += rows.length;
      } catch (error) {
        console.error("[digest]", error);
        report.failed += rows.length;
      }
    }
    return report;
  }

  // dispatch
  const { error: fanOutError } = await admin.rpc("notify_due_content");
  if (fanOutError) throw fanOutError;
  const { error: formsError } = await admin.rpc("notify_due_forms");
  if (formsError) throw formsError;
  await admin.rpc("expire_community_posts");
  const { data: rows, error } = await admin.rpc("claim_notification_deliveries", { batch: 200 });
  if (error) throw error;
  const deliveries = rows ?? [];
  report.processed = deliveries.length;
  const pushUsers = [
    ...new Set(deliveries.filter((d) => d.channel === "push").map((d) => d.user_id)),
  ];
  const { data: subscriptions } =
    pushUsers.length > 0
      ? await admin
          .from("push_subscriptions")
          .select("id, user_id, endpoint, keys")
          .in("user_id", pushUsers)
      : { data: [] as Array<{ id: string; user_id: string; endpoint: string; keys: unknown }> };

  for (const row of deliveries) {
    const policy = { quietHours: parseQuietHours(row.quiet_hours), shabbatMode: row.shabbat_mode };
    const location = locationFor({
      latitude: row.latitude,
      longitude: row.longitude,
      timezone: row.timezone,
    });
    const allowed = nextAllowedTime(now, policy, location);
    if (allowed > now) {
      await admin
        .from("notification_deliveries")
        .update({ scheduled_for: allowed.toISOString(), attempts: Math.max(0, row.attempts - 1) })
        .eq("id", row.delivery_id);
      report.deferred++;
      continue;
    }
    const locale = row.locale === "en" ? "en" : "fr";
    const tk = await translator(locale, "notifications.kinds");
    const rendered = renderNotification(
      row.kind,
      (row.payload ?? {}) as Record<string, unknown>,
      tk,
    );
    const href = `${site}${rendered.href}`;

    if (row.channel === "push") {
      if (!isPushConfigured()) {
        await skip(row.delivery_id, row.attempts, "push_not_configured");
        report.skipped++;
        continue;
      }
      const mine = (subscriptions ?? []).filter((s) => s.user_id === row.user_id);
      let delivered = false;
      for (const subscription of mine) {
        const keys = subscription.keys as { p256dh?: string; auth?: string } | null;
        if (!keys?.p256dh || !keys.auth) continue;
        const result = await sendPush(
          { endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
          { title: rendered.title, body: rendered.body, href: rendered.href, tag: row.kind },
        );
        if (result === "sent") delivered = true;
        if (result === "gone")
          await admin.from("push_subscriptions").delete().eq("id", subscription.id);
      }
      if (delivered || mine.length === 0) {
        await markSent(row.delivery_id, mine.length === 0 ? "no_subscription" : null);
        if (delivered) report.sent++;
        else report.skipped++;
      } else {
        await admin
          .from("notification_deliveries")
          .update({ last_error: "push_failed" })
          .eq("id", row.delivery_id);
        report.failed++;
      }
      continue;
    }

    if (!row.email || !isEmailConfigured()) {
      await skip(row.delivery_id, row.attempts, row.email ? "email_not_configured" : "no_email");
      report.skipped++;
      continue;
    }
    const te = await translator(locale, "emails");
    const { html, text } = renderEmail({
      greeting: te("greeting", { name: row.first_name }),
      intro: te("singleIntro"),
      items: [{ ...rendered, href }],
      cta: { label: te("open"), href },
      footer: te("footer", { app: appName, url: `${site}/notifications/preferences` }),
    });
    try {
      await sendEmail({ to: row.email, subject: `${appName} · ${rendered.title}`, html, text });
      await markSent(row.delivery_id, null);
      report.sent++;
    } catch (sendError) {
      console.error("[email]", sendError);
      await admin
        .from("notification_deliveries")
        .update({ last_error: String(sendError).slice(0, 300) })
        .eq("id", row.delivery_id);
      report.failed++;
    }
  }
  return report;

  async function markSent(id: string, note: string | null) {
    await admin
      .from("notification_deliveries")
      .update({ sent_at: now.toISOString(), last_error: note })
      .eq("id", id);
  }

  /** Not configured on this deployment: keep the row pending without burning attempts. */
  async function skip(id: string, attempts: number, note: string) {
    await admin
      .from("notification_deliveries")
      .update({ attempts: Math.max(0, attempts - 1), last_error: note })
      .eq("id", id);
  }
}
