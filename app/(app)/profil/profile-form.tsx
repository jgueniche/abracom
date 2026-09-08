"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { locales } from "@/lib/i18n/config";
import { type ProfileState, updateProfile } from "@/server/actions/profile";

const initialState: ProfileState = { status: "idle" };

export function ProfileForm({
  email,
  firstName,
  lastName,
  phone,
  locale,
  showHebrewDate,
}: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  locale: string;
  showHebrewDate: boolean;
}) {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" value={email} readOnly disabled className="min-h-11" />
        <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">{t("firstName")}</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={firstName}
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
            defaultValue={lastName}
            required
            maxLength={80}
            className="min-h-11"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">{t("phone")}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={phone}
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="locale">{t("language")}</Label>
        <Select name="locale" defaultValue={locale}>
          <SelectTrigger id="locale" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locales.map((code) => (
              <SelectItem key={code} value={code}>
                {tCommon(`locale.${code}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
        <div className="flex flex-col">
          <Label htmlFor="showHebrewDate">{t("hebrewDate")}</Label>
          <p className="text-sm text-muted-foreground">{t("hebrewDateHint")}</p>
        </div>
        <Switch id="showHebrewDate" name="showHebrewDate" defaultChecked={showHebrewDate} />
      </div>
      {state.status !== "idle" && (
        <p
          role="status"
          className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}
        >
          {state.message}
        </p>
      )}
      <Button type="submit" className="min-h-11 self-start" disabled={isPending}>
        {t("save")}
      </Button>
    </form>
  );
}
