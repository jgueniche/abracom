"use client";

import { FlaskConicalIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEST_PERSONA_KEYS } from "@/lib/auth/test-space";
import { enterTestSpace, type TestSpaceState } from "@/server/actions/test-space";

const initialState: TestSpaceState = { status: "idle" };

export function TestSpaceForm() {
  const t = useTranslations("testSchool");
  const [state, action, pending] = useActionState(enterTestSpace, initialState);
  const error = state.status === "error" ? state.message : undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="test-password">{t("password")}</Label>
        <Input
          id="test-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-11"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "test-error" : undefined}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("personaLegend")}</legend>
        {TEST_PERSONA_KEYS.map((persona, index) => (
          <label
            key={persona}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-checked:border-primary has-checked:bg-primary/5"
          >
            <input
              type="radio"
              name="persona"
              value={persona}
              defaultChecked={index === 0}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t(`personas.${persona}.name`)}</span>
              <span className="text-xs text-muted-foreground">{t(`personas.${persona}.hint`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error && (
        <p id="test-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="min-h-11" disabled={pending}>
        <FlaskConicalIcon aria-hidden />
        {pending ? t("entering") : t("enter")}
      </Button>
    </form>
  );
}
