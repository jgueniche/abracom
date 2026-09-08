"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { idle } from "@/server/actions/admin/_shared-client";
import { moderateMessage } from "@/server/actions/messaging";

export function ModerateForm({
  messageId,
  defaultReason,
}: {
  messageId: string;
  defaultReason: string;
}) {
  const t = useTranslations("adminReports");
  const [state, action] = useActionState(moderateMessage, idle);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="messageId" value={messageId} />
      <Input
        name="reason"
        defaultValue={defaultReason}
        required
        maxLength={300}
        className="min-h-10 max-w-xs"
      />
      <SubmitButton variant="destructive" size="sm" className="min-h-10">
        {t("remove")}
      </SubmitButton>
      <ActionMessage status={state.status} message={state.message} />
    </form>
  );
}
