"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idle } from "@/server/actions/admin/_shared-client";
import { updateGuardianFlags } from "@/server/actions/admin/students";

export function GuardianFlagsForm({
  studentId,
  userId,
  canViewGrades,
  canMessage,
  receivesNotifications,
  accessBlocked,
  accessBlockedReason,
  isAdmin,
}: {
  studentId: string;
  userId: string;
  canViewGrades: boolean;
  canMessage: boolean;
  receivesNotifications: boolean;
  accessBlocked: boolean;
  accessBlockedReason: string | null;
  isAdmin: boolean;
}) {
  const t = useTranslations("admin.students");
  const [state, action] = useActionState(updateGuardianFlags, idle);
  const [blocked, setBlocked] = useState(accessBlocked);

  const Check = ({
    name,
    label,
    defaultChecked,
  }: {
    name: string;
    label: string;
    defaultChecked: boolean;
  }) => (
    <label className="flex min-h-10 items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={!isAdmin}
        className="size-5 accent-primary"
      />
      {label}
    </label>
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="userId" value={userId} />
      <p className="text-xs font-medium text-muted-foreground uppercase">{t("rights")}</p>
      <Check name="canViewGrades" label={t("canViewGrades")} defaultChecked={canViewGrades} />
      <Check name="canMessage" label={t("canMessage")} defaultChecked={canMessage} />
      <Check
        name="receivesNotifications"
        label={t("receivesNotifications")}
        defaultChecked={receivesNotifications}
      />
      <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-destructive">
        <input
          type="checkbox"
          name="accessBlocked"
          checked={blocked}
          onChange={(e) => setBlocked(e.target.checked)}
          disabled={!isAdmin}
          className="size-5 accent-destructive"
        />
        {t("accessBlocked")}
      </label>
      {blocked && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`reason-${userId}`}>{t("accessBlockedReason")}</Label>
          <Input
            id={`reason-${userId}`}
            name="accessBlockedReason"
            defaultValue={accessBlockedReason ?? ""}
            required
            maxLength={500}
            disabled={!isAdmin}
            className="min-h-11"
          />
        </div>
      )}
      {isAdmin && (
        <div className="flex items-center gap-3">
          <SubmitButton variant="outline" size="sm" className="min-h-10">
            {t("save")}
          </SubmitButton>
          <ActionMessage status={state.status} message={state.message} />
        </div>
      )}
    </form>
  );
}
