"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idle } from "@/server/actions/admin/_shared-client";
import { createAttendanceList } from "@/server/actions/admin/attendance";

const WEEKDAYS = [1, 2, 3, 4, 5] as const;

/**
 * Two natures are created here: the roll call of a class, and a recurring
 * service. An outing's list is created from the outing itself, in three taps.
 */
export function AttendanceListForm({ classes }: { classes: { id: string; name: string }[] }) {
  const t = useTranslations("admin.attendance");
  const [state, action] = useActionState(createAttendanceList, idle);
  const [kind, setKind] = useState<"class_roll" | "service">("service");

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="list-kind">{t("kind")}</Label>
        <select
          id="list-kind"
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="service">{t("kinds.service")}</option>
          <option value="class_roll">{t("kinds.class_roll")}</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="list-name">{t("name")}</Label>
        <Input
          id="list-name"
          name="name"
          required
          maxLength={120}
          placeholder={t("namePlaceholder")}
          className="min-h-11"
        />
      </div>

      {kind === "class_roll" ? (
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="list-class">{t("classLabel")}</Label>
          <select
            id="list-class"
            name="classId"
            required
            className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
          >
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="list-code">{t("code")}</Label>
            <Input
              id="list-code"
              name="code"
              pattern="[a-z0-9_-]{2,40}"
              placeholder="garderie_soir"
              className="min-h-11"
            />
            <p className="text-xs text-muted-foreground">{t("codeHint")}</p>
          </div>
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">{t("classesLabel")}</legend>
            <p className="mb-1 text-xs text-muted-foreground">{t("classesHint")}</p>
            <div className="flex flex-wrap gap-2">
              {classes.map((item) => (
                <label
                  key={item.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm has-checked:border-primary has-checked:bg-primary/5"
                >
                  <input
                    type="checkbox"
                    name="classIds"
                    value={item.id}
                    className="size-5 accent-primary"
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">{t("weekdays")}</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <label
              key={day}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="checkbox"
                name="weekdays"
                value={day}
                defaultChecked
                className="size-5 accent-primary"
              />
              {t(`days.${day}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="list-starts">{t("startsOn")}</Label>
        <Input id="list-starts" name="startsOn" type="date" className="min-h-11" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="list-ends">{t("endsOn")}</Label>
        <Input id="list-ends" name="endsOn" type="date" className="min-h-11" />
      </div>

      <p className="text-xs text-muted-foreground sm:col-span-2">
        {kind === "class_roll" ? t("rollCallRules") : t("serviceRules")}
      </p>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <ActionMessage status={state.status} message={state.message} />
        <SubmitButton className="self-start">{t("createList")}</SubmitButton>
      </div>
    </form>
  );
}
