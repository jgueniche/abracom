"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitFormResponse } from "@/server/actions/community";
import { idle } from "@/server/actions/admin/_shared-client";
import type { FormField } from "@/lib/forms";

export function FormFill({
  formId,
  studentId,
  fields,
  answers,
  disabled,
}: {
  formId: string;
  studentId: string | null;
  fields: FormField[];
  answers: Record<string, unknown>;
  disabled: boolean;
}) {
  const t = useTranslations("community.forms");
  const [state, action] = useActionState(submitFormResponse, idle);
  const text = (id: string) => {
    const value = answers[id];
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  };
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="formId" value={formId} />
      {studentId && <input type="hidden" name="studentId" value={studentId} />}
      {fields.map((field) => {
        const name = `answer:${field.id}`;
        const label = `${field.label}${field.required ? " *" : ""}`;
        if (field.type === "textarea") {
          return (
            <div key={field.id} className="flex flex-col gap-2">
              <Label htmlFor={name}>{label}</Label>
              <Textarea
                id={name}
                name={name}
                rows={4}
                defaultValue={text(field.id)}
                required={field.required}
                disabled={disabled}
                maxLength={2000}
              />
            </div>
          );
        }
        if (field.type === "choice") {
          return (
            <fieldset key={field.id} className="flex flex-col gap-1">
              <legend className="text-sm font-medium">{label}</legend>
              {field.options?.map((option) => (
                <label key={option} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={name}
                    value={option}
                    defaultChecked={answers[field.id] === option}
                    required={field.required}
                    disabled={disabled}
                    className="size-4 accent-primary"
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          );
        }
        if (field.type === "multi") {
          const chosen = Array.isArray(answers[field.id]) ? (answers[field.id] as string[]) : [];
          return (
            <fieldset key={field.id} className="flex flex-col gap-1">
              <legend className="text-sm font-medium">{label}</legend>
              {field.options?.map((option) => (
                <label key={option} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={name}
                    value={option}
                    defaultChecked={chosen.includes(option)}
                    disabled={disabled}
                    className="size-4 accent-primary"
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          );
        }
        if (field.type === "yesno") {
          const value = answers[field.id];
          return (
            <fieldset key={field.id} className="flex flex-col gap-1">
              <legend className="text-sm font-medium">{label}</legend>
              <div className="flex gap-4">
                {(["yes", "no"] as const).map((option) => (
                  <label key={option} className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={name}
                      value={option}
                      defaultChecked={value === (option === "yes")}
                      required={field.required}
                      disabled={disabled}
                      className="size-4 accent-primary"
                    />
                    {t(option)}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        }
        return (
          <div key={field.id} className="flex flex-col gap-2">
            <Label htmlFor={name}>{label}</Label>
            <Input
              id={name}
              name={name}
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              defaultValue={text(field.id)}
              required={field.required}
              disabled={disabled}
              maxLength={500}
              className="min-h-11"
            />
          </div>
        );
      })}
      <ActionMessage status={state.status} message={state.message} />
      {!disabled && <SubmitButton className="min-h-11 sm:self-start">{t("submit")}</SubmitButton>}
    </form>
  );
}
