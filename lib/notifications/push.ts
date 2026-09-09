import "server-only";

import webpush, { type PushSubscription as WebPushSubscription, WebPushError } from "web-push";

import { publicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";

export type PushPayload = { title: string; body?: string | null; href: string; tag?: string };

export type PushResult = "sent" | "gone" | "failed";

let configured = false;

export function isPushConfigured(): boolean {
  const { VAPID_PRIVATE_KEY, VAPID_SUBJECT } = getServerEnv();
  return Boolean(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
}

function ensureConfigured(): void {
  if (configured) return;
  const { VAPID_PRIVATE_KEY, VAPID_SUBJECT } = getServerEnv();
  const publicKey = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    throw new Error("Web Push non configuré (clés VAPID manquantes).");
  }
  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, VAPID_PRIVATE_KEY);
  configured = true;
}

/** Sends one push message; `gone` means the subscription must be deleted (404 / 410). */
export async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
): Promise<PushResult> {
  ensureConfigured();
  try {
    await webpush.sendNotification(subscription as WebPushSubscription, JSON.stringify(payload), {
      TTL: 60 * 60 * 24,
      urgency: "normal",
    });
    return "sent";
  } catch (error) {
    if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
      return "gone";
    }
    console.error("[push]", error);
    return "failed";
  }
}
