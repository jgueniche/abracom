import "server-only";

import { getTranslations } from "next-intl/server";

import { appName, publicEnv } from "@/lib/env";
import { locationFor } from "@/lib/hebcal";
import {
  type EmailItem,
  type EmailSender,
  EmailSendError,
  isEmailConfigured,
  renderEmail,
  sendWithResend,
} from "@/lib/notifications/email";
import { parseQuietHours } from "@/lib/notifications/kinds";
import { isPushConfigured, sendPush } from "@/lib/notifications/push";
import { renderNotification, type Translate } from "@/lib/notifications/render";
import { isDigestWindow, nextAllowedTime } from "@/lib/notifications/schedule";
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

/** Wall-clock budget of one run (the route allows 60 s, pg_net waits 55 s). */
const TIME_BUDGET_MS = 45_000;
/** A delivery is retried at most this many times (mirrors the SQL claim). */
const MAX_ATTEMPTS = 5;
/** A person receives at most one digest per 20 hours. */
const DIGEST_SPACING_MS = 20 * 3_600_000;

/**
 * Delivery worker (brief §7.8). `dispatch` sends due push / e-mail deliveries and postpones the
 * ones falling on Shabbat / yom tov or in the user's quiet hours; `digest` e-mails the unread
 * notifications of the day (run hourly in the evening window); `reminders` queues the J-7 / J-1
 * event reminders, the birthday reminders and the retention purge.
 */
export async function runNotificationJob(
  task: JobTask,
  options: JobOptions = {},
): Promise<JobReport> {
  const now = options.now ?? new Date();
  const started = Date.now();
  const report: JobReport = { task, processed: 0, sent: 0, deferred: 0, failed: 0, skipped: 0 };
  const admin = createAdminClient();
  const sendEmail = options.sendEmail ?? sendWithResend;
  const site = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const preferencesUrl = `${site}/notifications/preferences`;

  const translators = new Map<string, Promise<Translate>>();
  function translator(locale: "fr" | "en", namespace: string): Promise<Translate> {
    const key = `${locale}:${namespace}`;
    let cached = translators.get(key);
    if (!cached) {
      cached = getTranslations({ locale, namespace }).then(
        (t): Translate =>
          (k, values) =>
            t(k as never, values as never),
      );
      translators.set(key, cached);
    }
    return cached;
  }

  if (task === "reminders") {
    const [events, birthdays, purge] = await Promise.all([
      admin.rpc("queue_event_reminders"),
      admin.rpc("queue_birthday_reminders"),
      admin.rpc("purge_expired_data"),
    ]);
    if (events.error) throw events.error;
    if (birthdays.error) throw birthdays.error;
    if (purge.error) throw purge.error;
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
      if (Date.now() - started > TIME_BUDGET_MS) break;
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
      const recentlyDigested =
        first.last_digest_at !== null &&
        now.getTime() - new Date(first.last_digest_at).getTime() < DIGEST_SPACING_MS;
      if (
        !first.email ||
        !isEmailConfigured() ||
        recentlyDigested ||
        !isDigestWindow(now, location.timezone) ||
        nextAllowedTime(now, policy, location) > now
      ) {
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
        footer: te("footer", { app: appName, url: preferencesUrl }),
      });
      const ids = rows.map((r) => r.notification_id);
      // claimed before sending so that an overlapping run never sends the same digest twice
      const { data: claimed } = await admin
        .from("notifications")
        .update({ digested_at: now.toISOString() })
        .in("id", ids)
        .is("digested_at", null)
        .select("id");
      if (!claimed?.length) {
        report.skipped += rows.length;
        continue;
      }
      try {
        await sendEmail({
          to: first.email,
          subject: te("digestSubject", { app: appName, count: rows.length }),
          html,
          text,
          unsubscribeUrl: preferencesUrl,
        });
        report.sent += rows.length;
      } catch (error) {
        console.error("[digest]", error instanceof Error ? error.message : String(error));
        await admin.from("notifications").update({ digested_at: null }).in("id", ids);
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
  const { data: rows, error } = await admin.rpc("claim_notification_deliveries", { batch: 100 });
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

  for (const [index, row] of deliveries.entries()) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      await release(deliveries.slice(index));
      break;
    }
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
        .update({
          scheduled_for: allowed.toISOString(),
          attempts: Math.max(0, row.attempts - 1),
          claimed_at: null,
        })
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
          {
            title: rendered.title,
            body: rendered.body,
            href: rendered.href,
            tag: `${row.kind}:${row.notification_id}`,
          },
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
        await markFailed(row.delivery_id, row.attempts, "push_failed");
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
      footer: te("footer", { app: appName, url: preferencesUrl }),
    });
    try {
      await sendEmail({
        to: row.email,
        subject: `${appName} · ${rendered.title}`,
        html,
        text,
        unsubscribeUrl: preferencesUrl,
      });
      await markSent(row.delivery_id, null);
      report.sent++;
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : String(sendError);
      console.error("[email]", message);
      if (sendError instanceof EmailSendError && sendError.status === 429) {
        // rate limited: try again in a minute without consuming an attempt
        await admin
          .from("notification_deliveries")
          .update({
            scheduled_for: new Date(now.getTime() + 60_000).toISOString(),
            attempts: Math.max(0, row.attempts - 1),
            claimed_at: null,
            last_error: "rate_limited",
          })
          .eq("id", row.delivery_id);
        report.deferred++;
      } else {
        await markFailed(row.delivery_id, row.attempts, message.slice(0, 300));
        report.failed++;
      }
    }
  }
  return report;

  async function markSent(id: string, note: string | null) {
    await admin
      .from("notification_deliveries")
      .update({ sent_at: now.toISOString(), last_error: note })
      .eq("id", id);
  }

  /** Exponential backoff: 5, 10, 20, 40 minutes; the fifth failure is final and logged. */
  async function markFailed(id: string, attempts: number, note: string) {
    if (attempts >= MAX_ATTEMPTS) {
      console.error(`[notifications] delivery ${id} abandoned after ${attempts} attempts: ${note}`);
    }
    const delay = 5 * 60_000 * 2 ** Math.max(0, attempts - 1);
    await admin
      .from("notification_deliveries")
      .update({
        scheduled_for: new Date(now.getTime() + delay).toISOString(),
        claimed_at: null,
        last_error: note,
      })
      .eq("id", id);
  }

  /** Not configured on this deployment: look again in an hour, without burning attempts. */
  async function skip(id: string, attempts: number, note: string) {
    await admin
      .from("notification_deliveries")
      .update({
        attempts: Math.max(0, attempts - 1),
        scheduled_for: new Date(now.getTime() + 3_600_000).toISOString(),
        claimed_at: null,
        last_error: note,
      })
      .eq("id", id);
  }

  /** Out of time: hand the rows back to the next run. */
  async function release(rows: typeof deliveries) {
    for (const row of rows) {
      await admin
        .from("notification_deliveries")
        .update({ attempts: Math.max(0, row.attempts - 1), claimed_at: null })
        .eq("id", row.delivery_id);
    }
  }
}
