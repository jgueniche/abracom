"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { bookAppointment } from "@/server/actions/community";
import { idle } from "@/server/actions/admin/_shared-client";

export function BookForm({
  classId,
  slotId,
  students,
}: {
  classId: string;
  slotId: string;
  students: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("community.appointments");
  const [state, action] = useActionState(bookAppointment, idle);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="slotId" value={slotId} />
      {students.length > 1 ? (
        <select
          name="studentId"
          aria-label={t("child")}
          className="min-h-10 rounded-lg border border-input bg-background px-2 text-sm"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="studentId" value={students[0]?.id ?? ""} />
      )}
      <SubmitButton size="sm" className="min-h-10">
        {t("book")}
      </SubmitButton>
      <ActionMessage status={state.status} message={state.message} />
    </form>
  );
}
