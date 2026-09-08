"use client";

import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { type InvitationBatchState, sendPendingInvitations } from "@/server/actions/admin/members";

const initial: InvitationBatchState = { status: "idle" };

export function SendInvitations({ pending }: { pending: number }) {
  const t = useTranslations("admin.members");
  const [state, action] = useActionState(sendPendingInvitations, initial);
  const remaining = state.remaining ?? pending;

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="limit" value="20" />
      <p className="font-medium">{t("pending", { count: remaining })}</p>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton disabled={remaining === 0} pendingLabel={t("sending")}>
          <SendIcon aria-hidden />
          {t("sendBatch")}
        </SubmitButton>
        <ActionMessage status={state.status} message={state.message} />
        {state.status === "success" && (
          <span className="text-sm text-muted-foreground">
            {t("batchRemaining", { count: state.remaining ?? 0 })}
            {state.failed ? ` · ${t("batchFailed", { count: state.failed })}` : ""}
          </span>
        )}
      </div>
    </form>
  );
}
