"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idle } from "@/server/actions/admin/_shared-client";
import { setMessagingMode } from "@/server/actions/admin/messaging";

const MODES = ["open", "closed", "scheduled"] as const;
const SCOPES = ["teachers", "staff", "direction"] as const;

/**
 * The tap itself. Three states, and the audiences they apply to — the direction
 * picks the reach every time (arbitrage 2), so closing the teachers can leave
 * the office open as the way out.
 */
export function MessagingModeForm({
  mode,
  scopes,
  urgencyContact,
}: {
  mode: (typeof MODES)[number];
  scopes: string[];
  urgencyContact: string;
}) {
  const t = useTranslations("admin.messaging");
  const [state, action] = useActionState(setMessagingMode, idle);
  const [current, setCurrent] = useState<(typeof MODES)[number]>(mode);

  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("modeLegend")}</legend>
        {MODES.map((value) => (
          <label
            key={value}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-primary/5"
          >
            <input
              type="radio"
              name="mode"
              value={value}
              defaultChecked={mode === value}
              onChange={() => setCurrent(value)}
              className="mt-1 size-5 shrink-0 accent-primary"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t(`modes.${value}`)}</span>
              <span className="text-xs text-muted-foreground">{t(`modeHints.${value}`)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset
        className="flex flex-col gap-2"
        // An open school constrains nobody, so the reach is not a question yet.
        hidden={current === "open"}
      >
        <legend className="mb-2 text-sm font-medium">{t("scopesLegend")}</legend>
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((value) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="checkbox"
                name="scopes"
                value={value}
                defaultChecked={scopes.includes(value)}
                className="size-5 accent-primary"
              />
              {t(`scopes.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="urgencyContact">{t("urgencyContact")}</Label>
        <Input
          id="urgencyContact"
          name="urgencyContact"
          defaultValue={urgencyContact}
          maxLength={200}
          placeholder={t("urgencyPlaceholder")}
          className="min-h-11"
        />
        <p className="text-xs text-muted-foreground">{t("urgencyHint")}</p>
      </div>

      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="self-start">{t("saveMode")}</SubmitButton>
    </form>
  );
}
