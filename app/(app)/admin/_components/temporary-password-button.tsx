"use client";

import { KeyRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { CredentialsList } from "@/components/domain/credentials-list";
import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { noCredentials } from "@/lib/auth/credentials";
import { giveTemporaryPassword } from "@/server/actions/admin/passwords";

/**
 * « Mot de passe provisoire » on a member's row (ADR-0075). It replaces a
 * password, so it asks first; once given, the new one shows in the same dialog,
 * this once.
 */
export function TemporaryPasswordButton({ userId, name }: { userId: string; name: string }) {
  const t = useTranslations("admin.passwords");
  const [open, setOpen] = useState(false);
  // A fresh form each time the dialog opens: an old password is never shown twice.
  const [round, setRound] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setRound((value) => value + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="min-h-11">
          <KeyRoundIcon aria-hidden />
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { name })}</DialogTitle>
          <DialogDescription>{t("warning", { name })}</DialogDescription>
        </DialogHeader>
        <TemporaryPasswordForm key={round} userId={userId} />
      </DialogContent>
    </Dialog>
  );
}

function TemporaryPasswordForm({ userId }: { userId: string }) {
  const t = useTranslations("admin.passwords");
  const [state, action] = useActionState(giveTemporaryPassword, noCredentials);

  if (state.status === "success" && state.credentials) {
    return <CredentialsList credentials={state.credentials} />;
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />
      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="self-start">{t("confirm")}</SubmitButton>
    </form>
  );
}
