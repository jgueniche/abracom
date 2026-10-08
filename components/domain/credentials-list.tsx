"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Credential } from "@/lib/auth/credentials";

/**
 * The credentials a screen has just created, shown this once (ADR-0075).
 *
 * The password is set large, in a typeface where l and 1 differ, because it is
 * read aloud over the phone or copied by hand. « Copier le message » takes the
 * whole note — the address of the application, the e-mail, the password and
 * what to do with it — so that the school pastes one thing into a text or an
 * e-mail instead of composing it each time.
 */
export function CredentialsList({ credentials }: { credentials: Credential[] }) {
  const t = useTranslations("credentials");
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(credential: Credential) {
    const message = t("message", {
      name: credential.name,
      url: window.location.origin,
      email: credential.email,
      password: credential.password ?? "",
    });
    try {
      await navigator.clipboard.writeText(message);
      setCopied(credential.email);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard unavailable: the password stays on the screen, selectable
    }
  }

  const fresh = credentials.some((c) => c.password);

  return (
    <div className="flex flex-col gap-3" role="status">
      {fresh && <p className="text-sm font-medium text-pretty">{t("onceOnly")}</p>}
      <ul className="flex flex-col divide-y divide-rule border-y border-rule">
        {credentials.map((credential) => (
          <li key={credential.email} className="flex flex-col gap-1.5 py-3">
            <p className="text-sm font-medium">{credential.name}</p>
            <p className="text-sm break-all text-muted-foreground">{credential.email}</p>
            {credential.password ? (
              <>
                <p className="font-mono text-lg tracking-wide select-all">{credential.password}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 self-start"
                  onClick={() => void copy(credential)}
                >
                  {copied === credential.email ? (
                    <CheckIcon aria-hidden />
                  ) : (
                    <CopyIcon aria-hidden />
                  )}
                  {copied === credential.email ? t("copied") : t("copyMessage")}
                </Button>
              </>
            ) : (
              <p className="text-sm text-pretty text-muted-foreground">{t("existing")}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
