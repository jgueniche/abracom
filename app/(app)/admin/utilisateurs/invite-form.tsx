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
import { inviteMember } from "@/server/actions/admin/members";

export function InviteForm() {
  const t = useTranslations("admin.members");
  const tRoles = useTranslations("roles");
  const tCommon = useTranslations("common");
  const [state, action] = useActionState(inviteMember, idle);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="i-email">{t("email")}</Label>
        <Input id="i-email" name="email" type="email" required className="min-h-11" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="i-first">{t("firstName")}</Label>
        <Input id="i-first" name="firstName" required maxLength={80} className="min-h-11" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="i-last">{t("lastName")}</Label>
        <Input id="i-last" name="lastName" required maxLength={80} className="min-h-11" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="i-role">{t("role")}</Label>
        <Select name="role" defaultValue="teacher">
          <SelectTrigger id="i-role" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["teacher", "staff", "school_admin"] as const).map((r) => (
              <SelectItem key={r} value={r}>
                {tRoles(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="i-locale">{t("language")}</Label>
        <Select name="locale" defaultValue="fr">
          <SelectTrigger id="i-locale" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fr">{tCommon("locale.fr")}</SelectItem>
            <SelectItem value="en">{tCommon("locale.en")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <ActionMessage status={state.status} message={state.message} />
        <SubmitButton className="self-start">{t("send")}</SubmitButton>
      </div>
    </form>
  );
}
