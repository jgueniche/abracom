"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { respondToEvent, type RsvpState } from "@/server/actions/agenda";

type Status = "yes" | "maybe" | "no";
const STATUSES: Status[] = ["yes", "maybe", "no"];
const initialState: RsvpState = { status: "idle" };

export function RsvpForm({
  eventId,
  initial,
}: {
  eventId: string;
  initial: { status: Status; guests_count: number; note: string | null } | null;
}) {
  const t = useTranslations("agenda.rsvp");
  const [state, action] = useActionState(respondToEvent, initialState);
  const [status, setStatus] = useState<Status>(initial?.status ?? "yes");

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={eventId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("title")}</legend>
        <div className="grid grid-cols-3 gap-2">
          {STATUSES.map((value) => (
            <label
              key={value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-medium",
                status === value && "border-primary bg-primary text-primary-foreground",
              )}
            >
              <input
                type="radio"
                name="status"
                value={value}
                checked={status === value}
                onChange={() => setStatus(value)}
                className="sr-only"
              />
              {t(value)}
            </label>
          ))}
        </div>
      </fieldset>
      {status === "yes" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="guests">{t("guests")}</Label>
          <Input
            id="guests"
            name="guests"
            type="number"
            min={0}
            max={20}
            inputMode="numeric"
            defaultValue={initial?.guests_count ?? 0}
            className="min-h-11 w-28"
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="note">{t("note")}</Label>
        <Textarea
          id="note"
          name="note"
          rows={2}
          maxLength={500}
          defaultValue={initial?.note ?? ""}
        />
      </div>
      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="min-h-11 w-full">{t("submit")}</SubmitButton>
    </form>
  );
}
