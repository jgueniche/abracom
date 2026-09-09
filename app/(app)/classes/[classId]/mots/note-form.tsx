"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { MarkdownEditor } from "@/components/forms/markdown-editor";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { idle } from "@/server/actions/admin/_shared-client";
import { createIndividualNote } from "@/server/actions/individual-notes";

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
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="classId" value={classId} />
      <div className="grid gap-4 sm:grid-cols-3">
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
