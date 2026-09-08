"use client";

import { useLocale, useTranslations } from "next-intl";
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
import { locales } from "@/lib/i18n/config";
import { completeOnboarding, type OnboardingState } from "@/server/actions/onboarding";

export type LegalItem = {
  id: string;
  kind: string;
  version: string;
  body: string;
  accepted: boolean;
};

const initialState: OnboardingState = { status: "idle" };

export function OnboardingForm({
  firstName,
  lastName,
  legal,
}: {
  firstName: string;
  lastName: string;
  legal: LegalItem[];
}) {
  const t = useTranslations("auth.onboarding");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [state, formAction, isPending] = useActionState(completeOnboarding, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">{t("firstName")}</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={firstName}
            required
            maxLength={80}
            autoComplete="given-name"
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
            autoComplete="family-name"
            className="min-h-11"
          />
        </div>
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

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-medium">{t("legalTitle")}</legend>
        <p className="text-sm text-muted-foreground">{t("legalHint")}</p>
        {legal.map((doc) => (
          <div key={doc.id} className="flex flex-col gap-2 rounded-xl border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {t(`kind.${doc.kind as "terms" | "charter" | "privacy"}`)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("version", { version: doc.version })}
                </p>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-primary">{t("read")}</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
                  {doc.body}
                </pre>
              </details>
            </div>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="accept"
                value={doc.id}
                defaultChecked={doc.accepted}
                required
                className="size-5 accent-primary"
              />
              {t("accept")}
            </label>
          </div>
        ))}
      </fieldset>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" className="min-h-11" disabled={isPending}>
        {t("submit")}
      </Button>
    </form>
  );
}
