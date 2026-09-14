"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { MarkdownEditor } from "@/components/forms/markdown-editor";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { idle } from "@/server/actions/admin/_shared-client";
import { createIndividualNote } from "@/server/actions/individual-notes";

/**
 * A note goes to one family, or to several, or to all of them.
 *
 * The picker was a single select, so "pensez au sac de piscine mardi" left a
 * teacher with two bad options: write it twenty-six times, or post it to the
 * whole class where it stops being addressed to anyone. Ticking several names
 * still writes one note per pupil — private, with its own read receipt.
 */
export function NoteForm({
  classId,
  students,
}: {
  classId: string;
  students: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("classSpace.notes");
  const tSpace = useTranslations("classSpace");
  const [state, action] = useActionState(createIndividualNote, idle);
  const [selected, setSelected] = useState<string[]>([]);
  const all = selected.length === students.length && students.length > 0;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="classId" value={classId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("students")}</legend>
        <p className="text-xs text-muted-foreground">{t("studentsHint")}</p>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => setSelected(e.target.checked ? students.map((s) => s.id) : [])}
            className="size-5 accent-primary"
          />
          {t("allStudents")}
        </label>
        <div className="grid grid-cols-2 gap-1 border-t border-rule pt-2 sm:grid-cols-3">
          {students.map((s) => (
            <label key={s.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="studentIds"
                value={s.id}
                checked={selected.includes(s.id)}
                onChange={(e) =>
                  setSelected((prev) =>
                    e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                  )
                }
                className="size-5 accent-primary"
              />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="kind">{t("kind")}</Label>
          <select
            id="kind"
            name="kind"
            defaultValue="info"
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {(["praise", "concern", "info"] as const).map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="visibility">{t("visibility")}</Label>
          <select
            id="visibility"
            name="visibility"
            defaultValue="parents"
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="parents">{tSpace("visibility.parents")}</option>
            <option value="staff">{tSpace("visibility.staff")}</option>
          </select>
        </div>
      </div>
      <MarkdownEditor name="bodyMd" label={t("body")} rows={4} required />
      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="self-start">{t("send")}</SubmitButton>
    </form>
  );
}
