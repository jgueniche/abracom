"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveDirectorySettings } from "@/server/actions/community";
import { idle } from "@/server/actions/admin/_shared-client";

export type DirectorySettings = {
  show_phone: boolean;
  show_email: boolean;
  show_children_names: boolean;
  show_address: boolean;
  address: string | null;
  show_birthday: boolean;
};

export function DirectorySettingsForm({ initial }: { initial: DirectorySettings | null }) {
  const t = useTranslations("community.directory");
  const [state, action] = useActionState(saveDirectorySettings, idle);
  const [showAddress, setShowAddress] = useState(initial?.show_address ?? false);
  const rows: Array<[string, string, boolean]> = [
    ["showPhone", t("showPhone"), initial?.show_phone ?? false],
    ["showEmail", t("showEmail"), initial?.show_email ?? false],
    ["showChildren", t("showChildren"), initial?.show_children_names ?? false],
    ["showBirthday", t("showBirthday"), initial?.show_birthday ?? false],
  ];
  return (
    <form action={action} className="flex flex-col gap-3">
      {rows.map(([name, label, checked]) => (
        <label key={name} className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            defaultChecked={checked}
            className="size-5 accent-primary"
          />
          {label}
        </label>
      ))}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="showAddress"
          checked={showAddress}
          onChange={(e) => setShowAddress(e.target.checked)}
          className="size-5 accent-primary"
        />
        {t("showAddress")}
      </label>
      {showAddress && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="address">{t("address")}</Label>
          <Input
            id="address"
            name="address"
            defaultValue={initial?.address ?? ""}
            maxLength={300}
            className="min-h-11"
          />
        </div>
      )}
      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="min-h-11 sm:self-start">{t("save")}</SubmitButton>
    </form>
  );
}
