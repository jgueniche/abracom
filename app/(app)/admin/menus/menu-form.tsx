"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { SectionHeader } from "@/components/layouts/section-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COURSES, dayFieldName, type DayValues, EMPTY_DAY } from "@/lib/menus";
import { idle } from "@/server/actions/admin/_shared-client";
import { saveWeeklyMenu } from "@/server/actions/admin/menus";

/**
 * Five days, five courses and a remark each — thirty short fields, typed on a
 * phone if need be. A day left blank is not a menu of nothing: it is a day
 * without canteen, and it disappears when saved.
 *
 * Each day is a group named by the rule above it (`SectionHeader`, the one way
 * a page names a section). It was a `<fieldset>` with a floated `<legend>`
 * first: a full-width float leaves a block-level grid beside it **zero** width,
 * so the fields collapsed to 22 px — under the 24 px of SC 2.5.8 — and spilled
 * off the right of a phone. Measured, not guessed (ADR-0069).
 */
export function MenuForm({
  weekStart,
  days,
  initial,
}: {
  weekStart: string;
  days: { day: number; label: string }[];
  initial: Record<number, DayValues> | null;
}) {
  const t = useTranslations("menus");
  const [state, action] = useActionState(saveWeeklyMenu, idle);

  return (
    <form action={action} className="flex flex-col gap-7">
      <input type="hidden" name="weekStart" value={weekStart} />
      <p className="-mb-2 text-xs text-muted-foreground">{t("admin.dayHint")}</p>

      {days.map(({ day, label }) => {
        const values = initial?.[day] ?? EMPTY_DAY;
        const noteId = dayFieldName(day, "note");
        const headingId = `menu-day-${day}`;
        return (
          <section key={day} aria-labelledby={headingId} className="min-w-0">
            <SectionHeader
              id={headingId}
              label={<span className="first-letter:uppercase">{label}</span>}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {COURSES.map((course) => {
                const id = dayFieldName(day, course);
                return (
                  <div key={course} className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor={id}>{t(`courses.${course}`)}</Label>
                    <Input
                      id={id}
                      name={id}
                      defaultValue={values[course]}
                      maxLength={120}
                      autoComplete="off"
                      className="min-h-11"
                    />
                  </div>
                );
              })}
              <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor={noteId}>{t("note")}</Label>
                <Input
                  id={noteId}
                  name={noteId}
                  defaultValue={values.note}
                  maxLength={200}
                  autoComplete="off"
                  className="min-h-11"
                />
              </div>
            </div>
          </section>
        );
      })}

      <div className="flex flex-col gap-3 border-t border-rule pt-5">
        <ActionMessage status={state.status} message={state.message} />
        <SubmitButton className="self-start" pendingLabel={t("admin.saving")}>
          {t("admin.save")}
        </SubmitButton>
      </div>
    </form>
  );
}
