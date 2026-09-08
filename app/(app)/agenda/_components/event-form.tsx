"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { type Audience, AudiencePicker } from "@/app/(app)/admin/_components/audience-picker";
import { ActionMessage } from "@/components/forms/action-message";
import { MarkdownEditor } from "@/components/forms/markdown-editor";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENT_KINDS, type EventKind } from "@/lib/calendar/events";
import { type EventFormState, saveEvent } from "@/server/actions/agenda";
import type { EventAudienceOptions } from "@/server/queries/agenda";

const TEMPLATES = [
  "none",
  "backToSchool",
  "classParty",
  "kabbalatShabbat",
  "chanukah",
  "purim",
  "yomHaatzmaut",
  "lagBaomer",
  "fair",
  "outing",
  "classPhoto",
] as const;
type Template = (typeof TEMPLATES)[number];

export type EventInitial = {
  id: string;
  title: string;
  descriptionMd: string;
  kind: EventKind;
  scope: "school" | "level" | "class";
  targetIds: string[];
  allDay: boolean;
  /** Naive local values for the inputs ("YYYY-MM-DDTHH:mm" or "YYYY-MM-DD"). */
  startsAt: string;
  endsAt: string;
  location: string | null;
  requiresRsvp: boolean;
  capacity: number | null;
  rsvpDeadline: string;
  costNote: string | null;
};

const initialState: EventFormState = { status: "idle" };

export function EventForm({
  options,
  locale,
  initial,
}: {
  options: EventAudienceOptions;
  locale: string;
  initial?: EventInitial;
}) {
  const t = useTranslations("agenda.form");
  const tk = useTranslations("agenda.kinds");
  const [state, action] = useActionState(saveEvent, initialState);
  const [template, setTemplate] = useState<Template>("none");
  const [kind, setKind] = useState<EventKind>(initial?.kind ?? "celebration");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.descriptionMd ?? "");
  const [bodyKey, setBodyKey] = useState(0);
  const [allDay, setAllDay] = useState(initial?.allDay ?? false);
  const [requiresRsvp, setRequiresRsvp] = useState(initial?.requiresRsvp ?? false);
  const allowed: Audience[] = options.staff ? ["school", "level", "class"] : ["class"];

  function applyTemplate(value: string) {
    const next = value as Template;
    setTemplate(next);
    if (next === "none") return;
    setTitle(t(`templates.${next}.title`));
    setKind(t(`templates.${next}.kind`) as EventKind);
    setBody(t(`templates.${next}.body`));
    setBodyKey((k) => k + 1);
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-4 sm:grid-cols-2">
        {!initial && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="template">{t("template")}</Label>
            <Select value={template} onValueChange={applyTemplate}>
              <SelectTrigger id="template" className="min-h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(`templates.${key}.label`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="kindSelect">{t("kind")}</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as EventKind)}>
            <SelectTrigger id="kindSelect" className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_KINDS.map((key) => (
                <SelectItem key={key} value={key}>
                  {tk(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">{t("title")}</Label>
        <Input
          id="title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          className="min-h-11"
        />
      </div>

      <MarkdownEditor
        key={bodyKey}
        name="descriptionMd"
        label={t("description")}
        defaultValue={body}
        rows={6}
      />

      <AudiencePicker
        options={{ levels: options.levels, classes: options.classes, users: [] }}
        initialAudience={initial?.scope ?? (options.staff ? "school" : "class")}
        initialTargets={initial?.targetIds}
        locale={locale}
        allowCustom={false}
        allowed={allowed}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="allDay"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="size-5 accent-primary"
          />
          {t("allDay")}
        </label>
        <div className="flex flex-col gap-2">
          <Label htmlFor="startsAt">{allDay ? t("startDate") : t("startsAt")}</Label>
          <Input
            id="startsAt"
            name="startsAt"
            type={allDay ? "date" : "datetime-local"}
            defaultValue={allDay ? initial?.startsAt.slice(0, 10) : initial?.startsAt}
            required
            className="min-h-11"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="endsAt">{allDay ? t("endDate") : t("endsAt")}</Label>
          <Input
            id="endsAt"
            name="endsAt"
            type={allDay ? "date" : "datetime-local"}
            defaultValue={allDay ? initial?.endsAt.slice(0, 10) : initial?.endsAt}
            className="min-h-11"
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="location">{t("location")}</Label>
          <Input
            id="location"
            name="location"
            defaultValue={initial?.location ?? ""}
            maxLength={200}
            className="min-h-11"
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border p-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="requiresRsvp"
            checked={requiresRsvp}
            onChange={(e) => setRequiresRsvp(e.target.checked)}
            className="size-5 accent-primary"
          />
          {t("requiresRsvp")}
        </label>
        {requiresRsvp && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="capacity">{t("capacity")}</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                inputMode="numeric"
                defaultValue={initial?.capacity ?? ""}
                className="min-h-11"
              />
              <p className="text-xs text-muted-foreground">{t("capacityHint")}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rsvpDeadline">{t("rsvpDeadline")}</Label>
              <Input
                id="rsvpDeadline"
                name="rsvpDeadline"
                type="datetime-local"
                defaultValue={initial?.rsvpDeadline}
                className="min-h-11"
              />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="costNote">{t("costNote")}</Label>
          <Input
            id="costNote"
            name="costNote"
            defaultValue={initial?.costNote ?? ""}
            maxLength={300}
            className="min-h-11"
          />
        </div>
      </fieldset>

      {!initial && (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="size-5 accent-primary" />
          {t("notify")}
        </label>
      )}

      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="min-h-11 sm:self-start">
        {initial ? t("save") : t("create")}
      </SubmitButton>
    </form>
  );
}
