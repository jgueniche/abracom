"use client";

import { useTranslations } from "next-intl";
import { useActionState, useTransition } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type OpenSchoolState, openSchool } from "@/server/actions/admin/schools";
import { switchSchool } from "@/server/actions/school";

const idle: OpenSchoolState = { status: "idle" };

export function OpenSchoolForm() {
  const t = useTranslations("admin.schools");
  const [state, action] = useActionState(openSchool, idle);
  const [switching, startSwitch] = useTransition();

  return (
    <form action={action} className="grid max-w-xl gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="school-name">{t("name")}</Label>
        <Input
          id="school-name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          placeholder={t("namePlaceholder")}
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="school-city">{t("city")}</Label>
        <Input id="school-city" name="city" maxLength={120} className="min-h-11" />
      </div>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <ActionMessage status={state.status} message={state.message} />
        <div className="flex flex-wrap gap-2">
          <SubmitButton>{t("open")}</SubmitButton>
          {state.status === "success" && state.schoolId && (
            <Button
              type="button"
              variant="outline"
              disabled={switching}
              onClick={() => {
                const data = new FormData();
                data.set("school", state.schoolId!);
                startSwitch(async () => {
                  await switchSchool(data);
                });
              }}
            >
              {t("goTo", { name: state.schoolName ?? "" })}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
