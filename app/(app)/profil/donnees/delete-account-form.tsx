"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAccount } from "@/server/actions/account";
import { idle } from "@/server/actions/admin/_shared-client";

export function DeleteAccountForm() {
  const t = useTranslations("dataRights");
  const [state, action] = useActionState(deleteMyAccount, idle);
  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("deleteHint")}</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">{t("confirmLabel", { word: t("confirmWord") })}</Label>
        <Input
          id="confirm"
          name="confirm"
          required
          autoComplete="off"
          className="min-h-11 max-w-xs"
        />
      </div>
      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton variant="destructive" className="min-h-11 sm:self-start">
        <Trash2Icon aria-hidden />
        {t("delete")}
      </SubmitButton>
    </form>
  );
}
