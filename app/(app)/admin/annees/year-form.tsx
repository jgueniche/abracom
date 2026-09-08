"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idle } from "@/server/actions/admin/_shared-client";
import { createSchoolYear } from "@/server/actions/admin/school-years";

export function YearForm({ suggestedLabel }: { suggestedLabel: string }) {
  const t = useTranslations("admin.years");
  const [state, action] = useActionState(createSchoolYear, idle);
  const [start] = suggestedLabel.split("-");
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="label">{t("label")}</Label>
        <Input
          id="label"
          name="label"
          defaultValue={suggestedLabel}
          pattern="\d{4}-\d{4}"
          required
          className="min-h-11"
        />
      </div>
      <div className="flex items-end gap-2 pb-1">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="makeCurrent" className="size-5 accent-primary" />
          {t("makeCurrent")}
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="startsOn">{t("startsOn")}</Label>
        <Input
          id="startsOn"
          name="startsOn"
          type="date"
          defaultValue={`${start}-09-01`}
          required
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="endsOn">{t("endsOn")}</Label>
        <Input
          id="endsOn"
          name="endsOn"
          type="date"
          defaultValue={`${Number(start) + 1}-07-06`}
          required
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <ActionMessage status={state.status} message={state.message} />
        <SubmitButton className="self-start">{t("create")}</SubmitButton>
      </div>
    </form>
  );
}
