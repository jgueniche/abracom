"use client";

import { BellOffIcon, BellRingIcon, SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { sendTestPush, subscribeToPush, unsubscribeFromPush } from "@/server/actions/push";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

function toUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const t = useTranslations("notificationPrefs.push");
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !publicKey) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setState(subscription ? "on" : "off"))
      .catch(() => setState("unsupported"));
  }, [publicKey]);

  function enable() {
    if (!publicKey) return;
    startTransition(async () => {
      setMessage(null);
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(publicKey) as BufferSource,
      });
      const json = subscription.toJSON();
      const result = await subscribeToPush({
        endpoint: json.endpoint ?? "",
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        userAgent: navigator.userAgent.slice(0, 300),
      });
      setMessage(result.message ?? null);
      setState(result.status === "success" ? "on" : "off");
    });
  }

  function disable() {
    startTransition(async () => {
      setMessage(null);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage(t("disabled"));
    });
  }

  function test() {
    startTransition(async () => {
      const result = await sendTestPush();
      setMessage(result.message ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {state === "unsupported"
          ? publicKey
            ? t("unsupported")
            : t("notConfigured")
          : state === "denied"
            ? t("denied")
            : state === "on"
              ? t("enabledHint")
              : t("description")}
      </p>
      <div className="flex flex-wrap gap-2">
        {state === "off" && (
          <Button type="button" onClick={enable} disabled={pending} className="min-h-11">
            <BellRingIcon aria-hidden />
            {t("enable")}
          </Button>
        )}
        {state === "on" && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={disable}
              disabled={pending}
              className="min-h-11"
            >
              <BellOffIcon aria-hidden />
              {t("disable")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={test}
              disabled={pending}
              className="min-h-11"
            >
              <SendIcon aria-hidden />
              {t("test")}
            </Button>
          </>
        )}
      </div>
      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
    </div>
  );
}
