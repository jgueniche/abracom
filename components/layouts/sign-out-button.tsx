"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions/auth";

/**
 * Signs out and forgets this browser's push subscription on the server (shared devices,
 * brief §8). The browser subscription itself is kept: the next person who signs in on this
 * device re-registers it under their own account (see ServiceWorkerRegistration).
 *
 * Exposed as a hook so the account menu can sign out from a menu item without
 * nesting a `<Button>` inside a `DropdownMenuItem`.
 */
export function useSignOut(): { signOut: () => void; pending: boolean } {
  const [pending, startTransition] = useTransition();

  const run = useCallback(() => {
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
  }, []);

  return { signOut: run, pending };
}

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("auth");
  const { signOut: run, pending } = useSignOut();

  return (
    <Button type="button" variant="outline" className={className} onClick={run} disabled={pending}>
      <LogOutIcon aria-hidden />
      {t("signOut")}
    </Button>
  );
}
