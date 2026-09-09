"use client";

import { BellRingIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { type RemindState, remindNonReaders } from "@/server/actions/admin/announcements";

const initial: RemindState = { status: "idle" };

export function RemindButton({
  announcementId,
  disabled,
}: {
  announcementId: string;
  disabled: boolean;
}) {
  const t = useTranslations("adminAnnouncements");
  const [state, action] = useActionState(remindNonReaders, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={announcementId} />
      <SubmitButton variant="secondary" disabled={disabled}>
        <BellRingIcon aria-hidden />
        {t("remind")}
      </SubmitButton>
      <ActionMessage status={state.status} message={state.message} />
    </form>
  );
}
