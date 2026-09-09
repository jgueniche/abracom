"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import {
  type AudienceOptions,
  AudiencePicker,
} from "@/app/(app)/admin/_components/audience-picker";
import { ActionMessage } from "@/components/forms/action-message";
import { MarkdownEditor } from "@/components/forms/markdown-editor";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type FormBuilderState, saveForm } from "@/server/actions/community";
import { FORM_FIELD_TYPES, type FormField, type FormFieldType } from "@/lib/forms";

export type FormInitial = {
  id: string;
  title: string;
  descriptionMd: string;
  audience: "school" | "level" | "class" | "custom";
  targetIds: string[];
  perStudent: boolean;
  opensAt: string;
  closesAt: string;
  fields: FormField[];
};

type Draft = {
  key: number;
  label: string;
  type: FormFieldType;
  required: boolean;
  options: string;
};
const initialState: FormBuilderState = { status: "idle" };

export function FormBuilder({
  options,
  locale,
  initial,
}: {
  options: AudienceOptions;
  locale: string;
  initial?: FormInitial;
}) {
  const t = useTranslations("community.admin");
  const [state, action] = useActionState(saveForm, initialState);
  const [fields, setFields] = useState<Draft[]>(
    initial?.fields.map((f, i) => ({
      key: i,
      label: f.label,
      type: f.type,
      required: f.required,
      options: (f.options ?? []).join("\n"),
    })) ?? [{ key: 0, label: "", type: "text", required: true, options: "" }],
  );
  const update = (key: number, patch: Partial<Draft>) =>
    setFields((list) => list.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  return (
    <form action={action} className="flex flex-col gap-6">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">{t("titleField")}</Label>
        <Input
          id="title"
          name="title"
          defaultValue={initial?.title}
          required
          maxLength={200}
          className="min-h-11"
        />
      </div>
      <MarkdownEditor
        name="descriptionMd"
        label={t("description")}
        defaultValue={initial?.descriptionMd ?? ""}
        rows={4}
      />
      <AudiencePicker
        options={options}
        initialAudience={initial?.audience}
        initialTargets={initial?.targetIds}
        locale={locale}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="perStudent"
            defaultChecked={initial?.perStudent}
            className="size-5 accent-primary"
          />
          {t("perStudent")}
        </label>
        <div className="flex flex-col gap-2">
          <Label htmlFor="opensAt">{t("opensAt")}</Label>
          <Input
            id="opensAt"
            name="opensAt"
            type="datetime-local"
            defaultValue={initial?.opensAt}
            className="min-h-11"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="closesAt">{t("closesAt")}</Label>
          <Input
            id="closesAt"
            name="closesAt"
            type="datetime-local"
            defaultValue={initial?.closesAt}
            className="min-h-11"
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border p-3">
        <legend className="px-1 text-sm font-medium">{t("fields")}</legend>
        {fields.map((f, index) => (
          <div
            key={f.key}
            className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_auto_auto]"
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor={`label-${f.key}`}>{t("fieldLabel")}</Label>
              <Input
                id={`label-${f.key}`}
                name="fieldLabel"
                value={f.label}
                onChange={(e) => update(f.key, { label: e.target.value })}
                required
                maxLength={200}
                className="min-h-11"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`type-${f.key}`}>{t("fieldType")}</Label>
              <select
                id={`type-${f.key}`}
                name="fieldType"
                value={f.type}
                onChange={(e) => update(f.key, { type: e.target.value as FormFieldType })}
                className="min-h-11 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {FORM_FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`types.${type}`)}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex min-h-11 items-end gap-2 pb-2 text-sm">
              <input type="hidden" name="fieldRequired" value={f.required ? "1" : "0"} />
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e) => update(f.key, { required: e.target.checked })}
                className="size-5 accent-primary"
              />
              {t("fieldRequired")}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 self-end"
              onClick={() => setFields((list) => list.filter((x) => x.key !== f.key))}
              disabled={fields.length === 1}
            >
              <XIcon aria-hidden />
              {t("removeField")}
            </Button>
            <div className="sm:col-span-4">
              <Textarea
                name="fieldOptions"
                value={f.options}
                onChange={(e) => update(f.key, { options: e.target.value })}
                rows={2}
                placeholder={t("fieldOptions")}
                aria-label={`${t("fieldOptions")} ${index + 1}`}
                className={f.type === "choice" || f.type === "multi" ? "" : "hidden"}
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 self-start"
          onClick={() =>
            setFields((list) => [
              ...list,
              { key: Date.now(), label: "", type: "text", required: false, options: "" },
            ])
          }
        >
          <PlusIcon aria-hidden />
          {t("addField")}
        </Button>
      </fieldset>

      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="min-h-11 sm:self-start">{t("save")}</SubmitButton>
    </form>
  );
}
