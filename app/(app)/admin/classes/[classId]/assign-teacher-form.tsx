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
import { idle } from "@/server/actions/admin/_shared-client";
import { assignTeacher } from "@/server/actions/admin/classes";

export function AssignTeacherForm({
  classId,
  teachers,
}: {
  classId: string;
  teachers: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("admin.classes");
  const tFamily = useTranslations("family");
  const [state, action] = useActionState(assignTeacher, idle);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="classId" value={classId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="userId">{t("teacher")}</Label>
        <Select name="userId" defaultValue={teachers[0]?.id}>
          <SelectTrigger id="userId" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((teacher) => (
              <SelectItem key={teacher.id} value={teacher.id}>
                {teacher.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="role">{t("role")}</Label>
        <Select name="role" defaultValue="main">
          <SelectTrigger id="role" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["main", "assistant", "specialist"] as const).map((role) => (
              <SelectItem key={role} value={role}>
                {tFamily(`teacherRole.${role}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="subject">{t("subject")}</Label>
        <Input id="subject" name="subject" maxLength={60} className="min-h-11" />
      </div>
      <SubmitButton>{t("assign")}</SubmitButton>
      <div className="sm:col-span-4">
        <ActionMessage status={state.status} message={state.message} />
      </div>
    </form>
  );
}
