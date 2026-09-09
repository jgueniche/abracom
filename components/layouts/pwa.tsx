"use client";

import { DownloadIcon, ShareIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "kesher-install-dismissed";

/**
 * Registers the service worker in production builds (offline fallback, asset cache, push) and
 * re-attaches an existing push subscription to the signed-in person (sign-out only forgets the
 * server row, so a shared device never keeps delivering to the previous account).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.pushManager?.getSubscription())
      .then((subscription) => {
        if (!subscription) return;
        return fetch("/api/push/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(subscription.toJSON()),
        });
      })
      .catch(() => {
        /* registration is best effort */
      });
  }, []);
  return null;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** "Add to home screen" banner: native prompt on Android / desktop, instructions on iOS Safari. */
export function InstallPrompt() {
  const t = useTranslations("pwa");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "native" | "ios">("hidden");

  useEffect(() => {
    try {
      if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }
    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    if (ios) setMode("ios");
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setMode("native");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (mode === "hidden") return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {
      /* private mode */
    }
    setMode("hidden");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setMode("hidden");
    else dismiss();
  }

  return (
    <div
      role="region"
      aria-label={t("install")}
      className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-background p-3 shadow-lg md:bottom-4"
    >
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{t("install")}</p>
        <p className="text-muted-foreground">{mode === "ios" ? t("iosHint") : t("installHint")}</p>
      </div>
      {mode === "native" ? (
        <Button type="button" size="sm" className="min-h-11" onClick={install}>
          <DownloadIcon aria-hidden />
          {t("installButton")}
        </Button>
      ) : (
        <ShareIcon className="size-5 shrink-0 text-primary" aria-hidden />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11"
        onClick={dismiss}
        aria-label={t("dismiss")}
      >
        <XIcon aria-hidden />
      </Button>
    </div>
  );
}
