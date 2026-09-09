"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idle } from "@/server/actions/admin/_shared-client";
import { createDocument } from "@/server/actions/admin/documents";

import { AudiencePicker, type AudienceOptions } from "../_components/audience-picker";

const PURPOSES = ["generic", "image_rights", "outing_authorization", "charter"] as const;

export function DocumentForm({
  options,
  folders,
  locale,
}: {
  options: AudienceOptions;
  folders: Array<{ id: string; name: string }>;
  locale: string;
}) {
  const t = useTranslations("adminDocuments");
  const tDocs = useTranslations("documents");
  const [state, action] = useActionState(createDocument, idle);
  const [requiresSignature, setRequiresSignature] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="file">{t("fields.file")}</Label>
        <Input id="file" name="file" type="file" required className="min-h-11" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="d-title">{t("fields.title")}</Label>
        <Input id="d-title" name="title" required maxLength={200} className="min-h-11" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="descriptionMd">{t("fields.description")}</Label>
        <Textarea id="descriptionMd" name="descriptionMd" rows={2} maxLength={5000} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="folderId">{t("fields.folder")}</Label>
          <select
            id="folderId"
            name="folderId"
            defaultValue=""
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">—</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="newFolder">{t("fields.newFolder")}</Label>
          <Input id="newFolder" name="newFolder" maxLength={80} className="min-h-11" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="purpose">{t("fields.purpose")}</Label>
          <select
            id="purpose"
            name="purpose"
            defaultValue="generic"
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {PURPOSES.map((p) => (
              <option key={p} value={p}>
                {tDocs(`purpose.${p}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <AudiencePicker options={options} locale={locale} allowCustom={false} />
      <div className="flex flex-col gap-1">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="requiresSignature"
            checked={requiresSignature}
            onChange={(e) => setRequiresSignature(e.target.checked)}
            className="size-5 accent-primary"
          />
          {t("fields.requiresSignature")}
        </label>
        {requiresSignature && (
          <label className="flex min-h-11 items-center gap-2 pl-7 text-sm">
            <input type="checkbox" name="signaturePerStudent" className="size-5 accent-primary" />
            {t("fields.signaturePerStudent")}
          </label>
        )}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="publishNow"
            defaultChecked
            className="size-5 accent-primary"
          />
          {t("fields.publishNow")}
        </label>
      </div>
      <ActionMessage status={state.status} message={state.message} />
      <SubmitButton className="self-start">{t("new")}</SubmitButton>
    </form>
  );
}
