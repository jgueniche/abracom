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

/**
 * A publication has one nature and, if it is a diary entry, one category.
 *
 * The composer used to offer four peers in a single select — "Cahier de vie",
 * "À préparer", "Info", "Rappel" — which matched nothing a reader ever sees:
 * the class space has a *Cahier de vie* tab and a *Devoirs* tab, and the last
 * two values were read by no screen at all. Two questions, asked in the order
 * a teacher thinks them: what am I publishing, and where does it go.
 */
const CATEGORIES = ["journal", "info", "reminder"] as const;
type Category = (typeof CATEGORIES)[number];
type PostType = Category | "homework";

const initial: PostFormState = { status: "idle" };

export function PostForm({
  classId,
  students,
  defaultType = "journal",
  post,
}: {
  classId: string;
  students: Array<{ id: string; name: string; imageRights: boolean }>;
  /** Pre-selected by the caller, so "Nouveau devoir" opens on Devoir. */
  defaultType?: PostType;
  /** Set when an existing publication is re-opened for editing. */
  post?: {
    id: string;
    title: string;
    bodyMd: string;
    subject: string | null;
    dueOn: string | null;
    visibility: "parents" | "staff";
  };
}) {
  const t = useTranslations("classSpace");
  const [state, action] = useActionState(saveClassPost, initial);
  const [kind, setKind] = useState<"journal" | "homework">(
    defaultType === "homework" ? "homework" : "journal",
  );
  const [category, setCategory] = useState<Category>(
    defaultType === "homework" ? "journal" : defaultType,
  );
  const [compressing, setCompressing] = useState(false);
  const [hasMedia, setHasMedia] = useState(false);
  const selectClass = "min-h-11 rounded-lg border border-input bg-background px-3 text-sm";

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="classId" value={classId} />
      {post && <input type="hidden" name="id" value={post.id} />}
      <input type="hidden" name="type" value={kind === "homework" ? "homework" : category} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="kind">{t("post.kind")}</Label>
          <select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "journal" | "homework")}
            className={selectClass}
          >
            <option value="journal">{t("post.kindJournal")}</option>
            <option value="homework">{t("post.kindHomework")}</option>
          </select>
        </div>
        {kind === "journal" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="category">{t("post.category")}</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className={selectClass}
            >
              {CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {t(`type.${key}`)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="dueOn">{t("post.dueOn")}</Label>
            <Input
              id="dueOn"
              name="dueOn"
              type="date"
              required
              defaultValue={post?.dueOn ?? ""}
              className="min-h-11"
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="subject">{t("post.subject")}</Label>
          <Input
            id="subject"
            name="subject"
            maxLength={60}
            defaultValue={post?.subject ?? ""}
            className="min-h-11"
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="title">{t("post.title")}</Label>
          <Input
            id="title"
            name="title"
            required
            maxLength={200}
            defaultValue={post?.title ?? ""}
            className="min-h-11"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="visibility">{t("post.visibility")}</Label>
          <select
            id="visibility"
            name="visibility"
            defaultValue={post?.visibility ?? "parents"}
            className={selectClass}
          >
            <option value="parents">{t("visibility.parents")}</option>
            <option value="staff">{t("visibility.staff")}</option>
          </select>
        </div>
      </div>

      <MarkdownEditor
        name="bodyMd"
        label={t("post.body")}
        rows={6}
        defaultValue={post?.bodyMd ?? ""}
      />

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
              className={`flex min-h-11 flex-wrap items-center gap-x-2 text-sm ${s.imageRights ? "" : "text-muted-foreground"}`}
            >
              <input
                type="checkbox"
                name="taggedStudentIds"
                value={s.id}
                disabled={!s.imageRights}
                className="size-5 accent-primary"
              />
              <span className="min-w-0">{s.name}</span>
              {!s.imageRights && (
                <span className="basis-full pl-7 text-xs">({t("post.noRights")})</span>
              )}
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
