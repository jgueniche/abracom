"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idle } from "@/server/actions/admin/_shared-client";
import { declareAbsence } from "@/server/actions/absences";

export function AbsenceForm({ students }: { students: Array<{ id: string; name: string }> }) {
  const t = useTranslations("classSpace.absences");
  const [state, action] = useActionState(declareAbsence, idle);
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
        <Label htmlFor="reason">{t("reason")}</Label>
        <Textarea id="reason" name="reason" rows={2} maxLength={500} />
      </div>
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
