"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/temporary-password";
import {
  changeMyPassword,
  chooseMyPassword,
  type PasswordChangeState,
} from "@/server/actions/password";

const idle: PasswordChangeState = { status: "idle" };

/**
 * Choosing a password: at the first sign-in (`choose`, nothing else to type) or
 * from the profile (`change`, the current one first). The address rides along,
 * hidden, so that a password manager files the new password under the right
 * account.
 */
export function PasswordForm({ mode, email }: { mode: "choose" | "change"; email: string | null }) {
  const t = useTranslations("password");
  const [state, action] = useActionState(
    mode === "choose" ? chooseMyPassword : changeMyPassword,
    idle,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {email && (
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      )}
      {mode === "change" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="current-password">{t("current")}</Label>
          <Input
            id="current-password"
            name="current"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
            className="min-h-11"
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">{t("new")}</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          aria-describedby="new-password-hint"
          className="min-h-11"
        />
        <p id="new-password-hint" className="text-xs text-muted-foreground">
          {t("hint", { min: PASSWORD_MIN_LENGTH })}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">{t("confirm")}</Label>
        <Input
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          className="min-h-11"
        />
      </div>
      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="self-start">
        {mode === "choose" ? t("submitChoose") : t("submitChange")}
      </SubmitButton>
    </form>
  );
}
