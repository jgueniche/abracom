"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
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
import { Textarea } from "@/components/ui/textarea";
import { idle } from "@/server/actions/admin/_shared-client";
import { createStudent, updateStudent } from "@/server/actions/admin/students";

export type ClassOption = { id: string; name: string };

export function StudentForm({
  classes,
  initial,
}: {
  classes: ClassOption[];
  initial?: {
    id: string;
    firstName: string;
    lastName: string;
    birthDate: string | null;
    allergiesNote: string | null;
    status: "active" | "left" | "archived";
  };
}) {
  const t = useTranslations("admin.students");
  const [state, action] = useActionState(initial ? updateStudent : createStudent, idle);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {initial && <input type="hidden" name="studentId" value={initial.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="firstName">{t("firstName")}</Label>
        <Input
          id="firstName"
          name="firstName"
          defaultValue={initial?.firstName}
          required
          maxLength={80}
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="lastName">{t("lastName")}</Label>
        <Input
          id="lastName"
          name="lastName"
          defaultValue={initial?.lastName}
          required
          maxLength={80}
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="birthDate">{t("birthDate")}</Label>
        <Input
          id="birthDate"
          name="birthDate"
          type="date"
          defaultValue={initial?.birthDate ?? ""}
          className="min-h-11"
        />
      </div>
      {initial ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">{t("status")}</Label>
          <Select name="status" defaultValue={initial.status}>
            <SelectTrigger id="status" className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["active", "left", "archived"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`statuses.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="classId">{t("class")}</Label>
          <Select name="classId">
            <SelectTrigger id="classId" className="min-h-11 w-full">
              <SelectValue placeholder={t("noClass")} />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="allergiesNote">{t("allergies")}</Label>
        <Textarea
          id="allergiesNote"
          name="allergiesNote"
          defaultValue={initial?.allergiesNote ?? ""}
          rows={2}
          maxLength={500}
        />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <ActionMessage status={state.status} message={state.message} />
        <SubmitButton className="self-start">{initial ? t("save") : t("create")}</SubmitButton>
      </div>
    </form>
  );
}
