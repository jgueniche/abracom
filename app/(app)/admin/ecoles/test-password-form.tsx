"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idle } from "@/server/actions/admin/_shared-client";
import { setTestPassword } from "@/server/actions/admin/schools";

export function TestPasswordForm() {
  const t = useTranslations("admin.schools");
  const [state, action] = useActionState(setTestPassword, idle);

  return (
    <form action={action} className="grid max-w-xl gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="test-password">{t("testPassword")}</Label>
        <Input
          id="test-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={72}
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="test-password-confirm">{t("testPasswordConfirm")}</Label>
        <Input
          id="test-password-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          maxLength={72}
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <ActionMessage status={state.status} message={state.message} />
        <SubmitButton className="self-start">{t("testPasswordSubmit")}</SubmitButton>
      </div>
    </form>
  );
}
