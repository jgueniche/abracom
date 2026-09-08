"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAppointmentSlots } from "@/server/actions/community";
import { idle } from "@/server/actions/admin/_shared-client";

export function SlotsForm({ classId }: { classId: string }) {
  const t = useTranslations("community.appointments");
  const [state, action] = useActionState(createAppointmentSlots, idle);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <input type="hidden" name="classId" value={classId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="date">{t("date")}</Label>
        <Input id="date" name="date" type="date" required className="min-h-11" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="from">{t("from")}</Label>
        <Input
          id="from"
          name="from"
          type="time"
          defaultValue="16:30"
          required
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="to">{t("to")}</Label>
        <Input id="to" name="to" type="time" defaultValue="18:30" required className="min-h-11" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="duration">{t("duration")}</Label>
        <Input
          id="duration"
          name="duration"
          type="number"
          min={5}
          max={120}
          defaultValue={15}
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="location">{t("location")}</Label>
        <Input id="location" name="location" maxLength={120} className="min-h-11" />
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
        <ActionMessage status={state.status} message={state.message} />
      </div>
      <SubmitButton className="min-h-11 sm:col-span-2 lg:col-span-5 lg:justify-self-start">
        {t("generate")}
      </SubmitButton>
    </form>
  );
}
