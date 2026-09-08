"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireCurrentUser } from "@/lib/auth/session";
import { isPushConfigured, sendPush } from "@/lib/notifications/push";
import { createClient } from "@/lib/supabase/server";

import { type ActionState, toActionError } from "./admin/_shared";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(200) }),
  userAgent: z.string().max(300).nullable().optional(),
});

export type PushSubscriptionInput = z.infer<typeof subscriptionSchema>;

/** Stores this browser's Web Push subscription (one row per endpoint, RLS: own rows only). */
export async function subscribeToPush(input: PushSubscriptionInput): Promise<ActionState> {
  try {
    const t = await getTranslations("notificationPrefs.push");
    const user = await requireCurrentUser();
    const parsed = subscriptionSchema.safeParse(input);
    if (!parsed.success) return { status: "error", message: t("error") };
    const supabase = await createClient();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: parsed.data.endpoint,
        keys: parsed.data.keys,
        user_agent: parsed.data.userAgent ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) return { status: "error", message: t("error") };
    return { status: "success", message: t("enabled") };
  } catch (error) {
    return toActionError(error);
  }
}

export async function unsubscribeFromPush(endpoint: string): Promise<ActionState> {
  try {
    const t = await getTranslations("notificationPrefs.push");
    const user = await requireCurrentUser();
    const supabase = await createClient();
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);
    return { status: "success", message: t("disabled") };
  } catch (error) {
    return toActionError(error);
  }
}

/** Sends a test message to every subscription of the signed-in user (bypasses the queue). */
export async function sendTestPush(): Promise<ActionState> {
  try {
    const t = await getTranslations("notificationPrefs.push");
    const user = await requireCurrentUser();
    if (!isPushConfigured()) return { status: "error", message: t("notConfigured") };
    const supabase = await createClient();
    const { data } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, keys")
      .eq("user_id", user.id);
    let sent = 0;
    for (const subscription of data ?? []) {
      const keys = subscription.keys as { p256dh?: string; auth?: string } | null;
      if (!keys?.p256dh || !keys.auth) continue;
      const result = await sendPush(
        { endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
        { title: t("testTitle"), body: t("testBody"), href: "/notifications", tag: "test" },
      );
      if (result === "sent") sent++;
      if (result === "gone")
        await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
    }
    return sent > 0
      ? { status: "success", message: t("testSent") }
      : { status: "error", message: t("testError") };
  } catch (error) {
    return toActionError(error);
  }
}
