"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idle } from "@/server/actions/admin/_shared-client";
import { createTimetableSlot } from "@/server/actions/timetable";

/** Add one slot: a day, two hours, a subject. Nothing else is required. */
export function SlotForm({
  classId,
  teachers,
}: {
  classId: string;
  teachers: { id: string; name: string }[];
}) {
  const t = useTranslations("timetable");
  const [state, action] = useActionState(createTimetableSlot, idle);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="classId" value={classId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="slot-weekday">{t("day")}</Label>
        <select
          id="slot-weekday"
          name="weekday"
          defaultValue="1"
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
        >
          {[1, 2, 3, 4, 5, 7].map((day) => (
            <option key={day} value={day}>
              {t(`days.${day}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slot-subject">{t("subject")}</Label>
        <Input
          id="slot-subject"
          name="subject"
          required
          maxLength={80}
          placeholder={t("subjectPlaceholder")}
          className="min-h-11"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slot-start">{t("startsAt")}</Label>
        <Input
          id="slot-start"
          name="startsAt"
          type="time"
          defaultValue="08:30"
          required
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="slot-end">{t("endsAt")}</Label>
        <Input
          id="slot-end"
          name="endsAt"
          type="time"
          defaultValue="09:30"
          required
          className="min-h-11"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slot-teacher">{t("teacher")}</Label>
        <select
          id="slot-teacher"
          name="teacherId"
          defaultValue=""
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="">{t("noTeacher")}</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slot-room">{t("room")}</Label>
        <Input id="slot-room" name="room" maxLength={60} className="min-h-11" />
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <ActionMessage status={state.status} message={state.message} />
        <SubmitButton className="self-start">{t("addSlot")}</SubmitButton>
      </div>
    </form>
  );
}
