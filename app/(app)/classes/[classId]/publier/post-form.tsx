"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { MarkdownEditor } from "@/components/forms/markdown-editor";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compressFileInput } from "@/lib/media-client";
import { type PostFormState, saveClassPost } from "@/server/actions/class-posts";

const TYPES = ["journal", "homework", "info", "reminder"] as const;
const initial: PostFormState = { status: "idle" };

export function PostForm({
  classId,
  students,
}: {
  classId: string;
  students: Array<{ id: string; name: string; imageRights: boolean }>;
}) {
  const t = useTranslations("classSpace");
  const [state, action] = useActionState(saveClassPost, initial);
  const [type, setType] = useState<(typeof TYPES)[number]>("journal");
  const [compressing, setCompressing] = useState(false);
  const [hasMedia, setHasMedia] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="classId" value={classId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">{t("post.type")}</Label>
          <select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {TYPES.map((k) => (
              <option key={k} value={k}>
                {t(`type.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="title">{t("post.title")}</Label>
          <Input id="title" name="title" required maxLength={200} className="min-h-11" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="subject">{t("post.subject")}</Label>
          <Input id="subject" name="subject" maxLength={60} className="min-h-11" />
        </div>
        {type === "homework" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="dueOn">{t("post.dueOn")}</Label>
            <Input id="dueOn" name="dueOn" type="date" required className="min-h-11" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="visibility">{t("post.visibility")}</Label>
          <select
            id="visibility"
            name="visibility"
            defaultValue="parents"
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="parents">{t("visibility.parents")}</option>
            <option value="staff">{t("visibility.staff")}</option>
          </select>
        </div>
      </div>

      <MarkdownEditor name="bodyMd" label={t("post.body")} rows={6} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="media">{t("post.media")}</Label>
        <Input
          id="media"
          name="media"
          type="file"
          accept="image/*"
          multiple
          className="min-h-11"
          onChange={async (event) => {
            setHasMedia((event.currentTarget.files?.length ?? 0) > 0);
            setCompressing(true);
            try {
              await compressFileInput(event.currentTarget);
            } finally {
              setCompressing(false);
            }
          }}
        />
        {compressing && <p className="text-xs text-muted-foreground">{t("post.compressing")}</p>}
        {hasMedia && (
          <label className="flex min-h-11 items-start gap-2 text-sm">
            <input type="checkbox" name="consent" required className="mt-1 size-5 accent-primary" />
            <span>{t("post.consent")}</span>
          </label>
        )}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t("post.tag")}</legend>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {students.map((s) => (
            <label
              key={s.id}
              className={`flex min-h-11 items-center gap-2 text-sm ${s.imageRights ? "" : "text-muted-foreground"}`}
            >
              <input
                type="checkbox"
                name="taggedStudentIds"
                value={s.id}
                disabled={!s.imageRights}
                className="size-5 accent-primary"
              />
              {s.name}
              {!s.imageRights && <span className="text-xs">({t("post.noRights")})</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <ActionMessage status={state.status} message={state.message} />
      <div className="flex gap-2">
        <SubmitButton name="intent" value="publish" disabled={compressing}>
          {t("post.publish")}
        </SubmitButton>
        <SubmitButton name="intent" value="draft" variant="outline" disabled={compressing}>
          {t("post.draft")}
        </SubmitButton>
      </div>
    </form>
  );
}
