"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyLoginTotp } from "@/server/actions/mfa";
import { idle } from "@/server/actions/admin/_shared-client";

export function VerificationForm({ next }: { next: string }) {
  const t = useTranslations("verification");
  const [state, action] = useActionState(verifyLoginTotp, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">{t("code")}</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          autoFocus
          required
          className="min-h-11 tracking-widest"
        />
      </div>
      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="min-h-11 w-full">{t("submit")}</SubmitButton>
    </form>
  );
}
