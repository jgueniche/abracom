"use client";

import { PenLineIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { idle } from "@/server/actions/admin/_shared-client";
import { signDocument } from "@/server/actions/documents";

export function SignForm({
  documentId,
  studentId,
  label,
}: {
  documentId: string;
  studentId?: string;
  label: string;
}) {
  const t = useTranslations("documents");
  const [state, action] = useActionState(signDocument, idle);
  if (state.status === "success")
    return <ActionMessage status={state.status} message={state.message} />;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="documentId" value={documentId} />
      {studentId && <input type="hidden" name="studentId" value={studentId} />}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        {t("consent")}
      </label>
      <div className="flex items-center gap-3">
        <SubmitButton size="sm" className="min-h-10" pendingLabel={t("signing")}>
          <PenLineIcon aria-hidden />
          {label}
        </SubmitButton>
        <ActionMessage status={state.status} message={state.message} />
      </div>
    </form>
  );
}
