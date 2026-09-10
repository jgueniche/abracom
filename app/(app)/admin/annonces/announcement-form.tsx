"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { MarkdownEditor } from "@/components/forms/markdown-editor";
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
import { type AnnouncementFormState, saveAnnouncement } from "@/server/actions/admin/announcements";

import {
  type Audience,
  AudiencePicker,
  type AudienceOptions,
} from "../_components/audience-picker";

const TEMPLATES = ["none", "circular", "reminder", "holiday", "outing"] as const;
type Template = (typeof TEMPLATES)[number];

export type AnnouncementInitial = {
  id: string;
  title: string;
  bodyMd: string;
  titleEn: string | null;
  bodyMdEn: string | null;
  audience: Audience;
  targetIds: string[];
  requiresAck: boolean;
  pinned: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  documentId: string | null;
  template: string | null;
};

const initialState: AnnouncementFormState = { status: "idle" };

function toLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AnnouncementForm({
  options,
  documents,
  locale,
  initial,
}: {
  options: AudienceOptions;
  documents: Array<{ id: string; title: string }>;
  locale: string;
  initial?: AnnouncementInitial;
}) {
  const t = useTranslations("adminAnnouncements");
  const [state, action] = useActionState(saveAnnouncement, initialState);
  const [template, setTemplate] = useState<Template>((initial?.template as Template) ?? "none");
  const [body, setBody] = useState(initial?.bodyMd ?? "");
  const [bodyKey, setBodyKey] = useState(0);

  function applyTemplate(value: string) {
    const next = value as Template;
    setTemplate(next);
    if (next !== "none" && !initial) {
      setBody(t(`templateBodies.${next}`));
      setBodyKey((k) => k + 1);
    }
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="template" value={template === "none" ? "" : template} />
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="template">{t("template")}</Label>
          <Select value={template} onValueChange={applyTemplate}>
            <SelectTrigger id="template" className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATES.map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`templates.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">{t("fields.title")}</Label>
          <Input
            id="title"
            name="title"
            defaultValue={initial?.title}
            required
            maxLength={200}
            className="min-h-11"
          />
        </div>
      </div>

      <MarkdownEditor
        key={bodyKey}
        name="bodyMd"
        label={t("fields.body")}
        defaultValue={body}
        required
      />

      <details className="rounded-xl border p-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
          {t("fields.translation")}
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="titleEn">{t("fields.titleEn")}</Label>
            <Input
              id="titleEn"
              name="titleEn"
              defaultValue={initial?.titleEn ?? ""}
              maxLength={200}
              className="min-h-11"
            />
          </div>
          <MarkdownEditor
            name="bodyMdEn"
            label={t("fields.bodyEn")}
            defaultValue={initial?.bodyMdEn ?? ""}
            rows={6}
          />
        </div>
      </details>

      <AudiencePicker
        options={options}
        initialAudience={initial?.audience}
        initialTargets={initial?.targetIds}
        locale={locale}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requiresAck"
            defaultChecked={initial?.requiresAck}
            className="size-5 accent-primary"
          />
          {t("fields.requiresAck")}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="pinned"
            defaultChecked={initial?.pinned}
            className="size-5 accent-primary"
          />
          {t("fields.pinned")}
        </label>
        <div className="flex flex-col gap-2">
          <Label htmlFor="publishedAt">{t("fields.publishedAt")}</Label>
          <Input
            id="publishedAt"
            name="publishedAt"
            type="datetime-local"
            defaultValue={toLocal(initial?.publishedAt ?? null)}
            className="min-h-11"
          />
          <p className="text-xs text-muted-foreground">{t("fields.publishedAtHint")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="expiresAt">{t("fields.expiresAt")}</Label>
          <Input
            id="expiresAt"
            name="expiresAt"
            type="datetime-local"
            defaultValue={toLocal(initial?.expiresAt ?? null)}
            className="min-h-11"
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="documentId">{t("fields.document")}</Label>
          <select
            id="documentId"
            name="documentId"
            defaultValue={initial?.documentId ?? ""}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("fields.noDocument")}</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ActionMessage status={state.status} message={state.message} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="intent" value="save" variant="outline">
          {t("save")}
        </SubmitButton>
        <SubmitButton name="intent" value="publish">
          {t("publish")}
        </SubmitButton>
        {initial?.publishedAt && (
          <SubmitButton name="intent" value="draft" variant="ghost">
            {t("unpublish")}
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
