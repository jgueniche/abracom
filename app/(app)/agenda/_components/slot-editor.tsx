"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addSlot, removeSlot } from "@/server/actions/agenda";
import { idle } from "@/server/actions/admin/_shared-client";

export function SlotEditor({
  eventId,
  slots,
}: {
  eventId: string;
  slots: Array<{ id: string; label: string; needed: number; taken: number }>;
}) {
  const t = useTranslations("agenda.form");
  const ts = useTranslations("agenda.slots");
  const [state, action] = useActionState(addSlot, idle);

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-3">
      <h2 className="font-medium">{t("slots")}</h2>
      <p className="text-xs text-muted-foreground">{t("slotsHint")}</p>
      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noSlots")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {slots.map((slot) => (
            <li key={slot.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">
                {slot.label} · {ts("needed", { taken: slot.taken, needed: slot.needed })}
              </span>
              <form action={removeSlot}>
                <input type="hidden" name="slotId" value={slot.id} />
                <input type="hidden" name="eventId" value={eventId} />
                <Button type="submit" variant="ghost" size="sm" className="min-h-9">
                  <XIcon aria-hidden />
                  {t("removeSlot")}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <input type="hidden" name="eventId" value={eventId} />
        <div className="flex flex-col gap-1">
          <Label htmlFor="slotLabel">{t("slotLabel")}</Label>
          <Input id="slotLabel" name="label" required maxLength={120} className="min-h-11" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="slotNeeded">{t("slotNeeded")}</Label>
          <Input
            id="slotNeeded"
            name="needed"
            type="number"
            min={1}
            max={50}
            defaultValue={1}
            inputMode="numeric"
            className="min-h-11 w-24"
          />
        </div>
        <SubmitButton variant="secondary">
          <PlusIcon aria-hidden />
          {t("addSlot")}
        </SubmitButton>
      </form>
      <ActionMessage status={state.status} message={state.message} />
    </section>
  );
}
