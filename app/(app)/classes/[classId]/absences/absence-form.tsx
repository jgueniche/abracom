"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idle } from "@/server/actions/admin/_shared-client";
import { declareAbsence } from "@/server/actions/absences";

export function AbsenceForm({
  students,
  canSign = false,
  defaultName = "",
}: {
  students: Array<{ id: string; name: string }>;
  /** A guardian signs their own note; the office records what it was told. */
  canSign?: boolean;
  defaultName?: string;
}) {
  const t = useTranslations("classSpace.absences");
  const [state, action] = useActionState(declareAbsence, idle);
  const [signing, setSigning] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="studentId">{t("student")}</Label>
        <select
          id="studentId"
          name="studentId"
          required
          className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="kind">{t("kind")}</Label>
        <select
          id="kind"
          name="kind"
          defaultValue="absence"
          className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="absence">{t("kinds.absence")}</option>
          <option value="late">{t("kinds.late")}</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="startsOn">{t("startsOn")}</Label>
        <Input
          id="startsOn"
          name="startsOn"
          type="date"
          defaultValue={today}
          required
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="endsOn">{t("endsOn")}</Label>
        <Input id="endsOn" name="endsOn" type="date" defaultValue={today} className="min-h-11" />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="reason">{signing ? t("statement") : t("reason")}</Label>
        <Textarea
          id="reason"
          name="reason"
          rows={2}
          maxLength={500}
          required={signing}
          placeholder={signing ? t("statementPlaceholder") : undefined}
        />
      </div>

      {/* Session 20: the note is written and signed on the phone, at 7 a.m.,
          without a printer. The school still decides whether it justifies the
          absence — signing submits, it does not grant. */}
      {canSign && (
        <div className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:col-span-2">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="sign"
              checked={signing}
              onChange={(event) => setSigning(event.target.checked)}
              className="mt-1 size-5 shrink-0 accent-primary"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{t("signLabel")}</span>
              <span className="text-xs text-muted-foreground">{t("signHint")}</span>
            </span>
          </label>
          {signing && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="signedName">{t("signedName")}</Label>
              <Input
                id="signedName"
                name="signedName"
                defaultValue={defaultName}
                required
                minLength={2}
                maxLength={120}
                className="min-h-11"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="justification">{t("justification")}</Label>
        <Input
          id="justification"
          name="justification"
          type="file"
          accept="application/pdf,image/*"
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <ActionMessage status={state.status} message={state.message} />
        <SubmitButton className="self-start">{t("submit")}</SubmitButton>
      </div>
    </form>
  );
}
