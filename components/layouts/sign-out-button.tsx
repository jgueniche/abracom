"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions/auth";

/**
 * Signs out and forgets this browser's push subscription on the server (shared devices,
 * brief §8). The browser subscription itself is kept: the next person who signs in on this
 * device re-registers it under their own account (see ServiceWorkerRegistration).
 */
export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      let endpoint: string | null = null;
      try {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.getRegistration();
          const subscription = await registration?.pushManager.getSubscription();
          if (subscription) endpoint = subscription.endpoint;
        }
      } catch {
        // best effort
      }
      await signOut(endpoint);
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={handleSignOut}
      disabled={pending}
    >
      <LogOutIcon aria-hidden />
      {t("signOut")}
    </Button>
  );
}
