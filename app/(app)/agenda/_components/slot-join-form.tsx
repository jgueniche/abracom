"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { signUpForSlot } from "@/server/actions/agenda";
import { idle } from "@/server/actions/admin/_shared-client";

export function SlotJoinForm({ slotId, eventId }: { slotId: string; eventId: string }) {
  const t = useTranslations("agenda.slots");
  const [state, action] = useActionState(signUpForSlot, idle);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="eventId" value={eventId} />
      <Input
        name="note"
        placeholder={t("note")}
        aria-label={t("note")}
        maxLength={200}
        className="min-h-11 sm:max-w-xs"
      />
      <SubmitButton variant="secondary" size="sm" className="min-h-11">
        {t("join")}
      </SubmitButton>
      <ActionMessage status={state.status} message={state.message} />
    </form>
  );
}
