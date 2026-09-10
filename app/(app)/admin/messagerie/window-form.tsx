"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idle } from "@/server/actions/admin/_shared-client";
import { createMessagingWindow } from "@/server/actions/admin/messaging";

/**
 * "Ouvrir le mardi 17 h – 19 h" and "fermer du 15 au 30 juin" are the same
 * object with a different `kind`, so they share one form instead of two.
 */
export function MessagingWindowForm({
  classes,
  teachers,
  defaultStart,
  defaultEnd,
}: {
  classes: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  defaultStart: string;
  defaultEnd: string;
}) {
  const t = useTranslations("admin.messaging");
  const [state, action] = useActionState(createMessagingWindow, idle);
  const [narrow, setNarrow] = useState<"school" | "class" | "teacher">("school");

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="window-kind">{t("windowKind")}</Label>
        <select
          id="window-kind"
          name="kind"
          defaultValue="open"
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="open">{t("windowKinds.open")}</option>
          <option value="closed">{t("windowKinds.closed")}</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="window-scope">{t("windowScope")}</Label>
        <select
          id="window-scope"
          name="scope"
          defaultValue="teachers"
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="teachers">{t("scopes.teachers")}</option>
          <option value="staff">{t("scopes.staff")}</option>
          <option value="direction">{t("scopes.direction")}</option>
          <option value="all">{t("scopes.all")}</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="opensAt">{t("opensAt")}</Label>
        <Input
          id="opensAt"
          name="opensAt"
          type="datetime-local"
          defaultValue={defaultStart}
          required
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="closesAt">{t("closesAt")}</Label>
        <Input
          id="closesAt"
          name="closesAt"
          type="datetime-local"
          defaultValue={defaultEnd}
          required
          className="min-h-11"
        />
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="window-narrow">{t("windowNarrow")}</Label>
        <select
          id="window-narrow"
          value={narrow}
          onChange={(event) => setNarrow(event.target.value as typeof narrow)}
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="school">{t("narrow.school")}</option>
          <option value="class">{t("narrow.class")}</option>
          <option value="teacher">{t("narrow.teacher")}</option>
        </select>
      </div>

      {narrow === "class" && (
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="classId">{t("narrow.class")}</Label>
          <select
            id="classId"
            name="classId"
            className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
          >
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {narrow === "teacher" && (
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="targetUserId">{t("narrow.teacher")}</Label>
          <select
            id="targetUserId"
            name="targetUserId"
            className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
          >
            {teachers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="note">{t("windowNote")}</Label>
        <Input id="note" name="note" maxLength={200} className="min-h-11" />
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <ActionMessage status={state.status} message={state.message} />
        <SubmitButton className="self-start">{t("addWindow")}</SubmitButton>
      </div>
    </form>
  );
}
