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
import { RELATIONS } from "@/lib/import/families";
import { idle } from "@/server/actions/admin/_shared-client";
import { linkGuardian } from "@/server/actions/admin/students";

export function LinkGuardianForm({ studentId }: { studentId: string }) {
  const t = useTranslations("admin.students");
  const tFamily = useTranslations("family");
  const tCommon = useTranslations("common");
  const [state, action] = useActionState(linkGuardian, idle);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="g-email">{t("email")}</Label>
        <Input id="g-email" name="email" type="email" required className="min-h-11" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="g-first">{t("firstName")}</Label>
        <Input id="g-first" name="firstName" maxLength={80} className="min-h-11" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="g-last">{t("lastName")}</Label>
        <Input id="g-last" name="lastName" maxLength={80} className="min-h-11" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="g-relation">{t("relation")}</Label>
        <Select name="relation" defaultValue="mother">
          <SelectTrigger id="g-relation" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RELATIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {tFamily(`relation.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="g-locale">{t("language")}</Label>
        <Select name="locale" defaultValue="fr">
          <SelectTrigger id="g-locale" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fr">{tCommon("locale.fr")}</SelectItem>
            <SelectItem value="en">{tCommon("locale.en")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isPrimary" className="size-5 accent-primary" />
        {t("isPrimary")}
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <ActionMessage status={state.status} message={state.message} />
        <SubmitButton className="self-start">{t("linkGuardian")}</SubmitButton>
      </div>
    </form>
  );
}
