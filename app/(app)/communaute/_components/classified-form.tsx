"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type ClassifiedState, createClassified } from "@/server/actions/community";

const CATEGORIES = [
  "carpool",
  "childcare",
  "lost_found",
  "marketplace",
  "recommendation",
  "other",
] as const;
const initialState: ClassifiedState = { status: "idle" };

export function ClassifiedForm() {
  const t = useTranslations("community.classifieds");
  const [state, action] = useActionState(createClassified, initialState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="category">{t("fields.category")}</Label>
        <select
          id="category"
          name="category"
          className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {CATEGORIES.map((key) => (
            <option key={key} value={key}>
              {t(`categories.${key}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">{t("fields.title")}</Label>
        <Input
          id="title"
          name="title"
          required
          minLength={3}
          maxLength={200}
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="body">{t("fields.body")}</Label>
        <Textarea id="body" name="body" required rows={6} maxLength={5000} />
      </div>
      <p className="text-xs text-muted-foreground">{t("moderationNotice")}</p>
      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="min-h-11 sm:self-start">{t("submit")}</SubmitButton>
    </form>
  );
}
