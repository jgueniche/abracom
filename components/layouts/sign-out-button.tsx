"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions/auth";

/** Signs out after releasing this browser's push subscription (shared devices, brief §8). */
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
          if (subscription) {
            endpoint = subscription.endpoint;
            await subscription.unsubscribe();
          }
        }
      } catch {
        // best effort: the server row is removed anyway when the endpoint is known
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
