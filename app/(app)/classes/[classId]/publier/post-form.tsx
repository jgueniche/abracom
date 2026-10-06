"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ActionMessage } from "@/components/forms/action-message";
import { AttachmentPicker } from "@/components/forms/attachment-picker";
import { MarkdownEditor } from "@/components/forms/markdown-editor";
import { SubmitButton } from "@/components/forms/submit-button";
import { useUploads } from "@/components/forms/use-uploads";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";
import { classMediaFolder, IMAGE_EDGES, UPLOAD_LIMITS } from "@/lib/uploads/shared";
import { type PostFormState, saveClassPost } from "@/server/actions/class-post-publish";

/**
 * An entry of the cahier de vie, filed under one of its three categories.
 *
 * The composer used to offer « Devoir » too, in a select at its top; homework has its own
 * composer since session 33 (ADR-0070), which this one now points to. Its photos travel the
 * moment they are chosen (ADR-0071): the old field promised « jusqu'à 20 photos » and failed
 * past three, the request being capped at 1 MB.
 */
const CATEGORIES = ["journal", "info", "reminder"] as const;
type Category = (typeof CATEGORIES)[number];

const initial: PostFormState = { status: "idle" };

export function PostForm({
  classId,
  schoolId,
  postId,
  students,
  defaultType = "journal",
  post,
}: {
  classId: string;
  schoolId: string;
  /** Chosen by the server for a new entry, so its photos have a folder before it exists. */
  postId: string;
  students: Array<{ id: string; name: string; imageRights: boolean }>;
  defaultType?: Category;
  /** Set when an existing publication is re-opened for editing. */
  post?: {
    title: string;
    bodyMd: string;
    subject: string | null;
    visibility: "parents" | "staff";
  };
}) {
  const t = useTranslations("classSpace");
  const tAttachments = useTranslations("attachments");
  const router = useRouter();
  const [state, action] = useActionState(saveClassPost, initial);
  const [category, setCategory] = useState<Category>(defaultType);
  const uploads = useUploads({
    bucket: "class-media",
    folder: classMediaFolder(schoolId, classId, postId),
    maxFiles: UPLOAD_LIMITS.classMedia.maxFiles * 2,
    maxPdfBytes: 0,
    allowPdf: false,
    image: { maxEdge: IMAGE_EDGES.photo, quality: 0.88 },
    normalisedByServer: true,
  });
  const selectClass = "min-h-11 rounded-lg border border-input bg-background px-3 text-sm";
  const hasPhotos = uploads.items.length > 0;

  // Saved: the photos belong to the post now, and the teacher sees it where families will.
  const handled = useRef<PostFormState | null>(null);
  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status !== "success") return;
    uploads.reset();
    if (state.message) toast.success(state.message);
    router.push(`/classes/${classId}/cahier`);
  }, [state, uploads, router, classId]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="editing" value={post ? "true" : "false"} />
      <input type="hidden" name="type" value={category} />
      {!post && (
        <p className="text-sm text-muted-foreground">
          {t("post.homeworkElsewhere")}{" "}
          <Link
            href={`/devoirs/nouveau?classe=${classId}&retour=classe`}
            className="font-medium text-primary underline decoration-primary/30 underline-offset-[3px] hover:decoration-primary"
          >
            {t("post.homeworkLink")}
          </Link>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
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
        <div className="flex flex-col gap-2 sm:col-span-3">
          <Label htmlFor="title">{t("post.title")}</Label>
          <Input
            id="title"
            name="title"
            required
            maxLength={200}
            defaultValue={post?.title ?? ""}
            dir="auto"
            className="min-h-11"
          />
        </div>
      </div>

      <MarkdownEditor
        name="bodyMd"
        label={t("post.body")}
        rows={6}
        defaultValue={post?.bodyMd ?? ""}
      />

      <AttachmentPicker
        uploads={uploads}
        label={t("post.media")}
        cameraLabel={tAttachments("takePhoto")}
        allowPdf={false}
        rotatable
      >
        <p className="text-xs text-muted-foreground">{t("post.mediaHint")}</p>
      </AttachmentPicker>
      {hasPhotos && (
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input type="checkbox" name="consent" required className="mt-1 size-5 accent-primary" />
          <span>{t("post.consent")}</span>
        </label>
      )}
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
      {uploads.failed && (
        <p role="alert" className="text-sm text-destructive">
          {tAttachments("failedHint")}
        </p>
      )}
      <div className="flex gap-2">
        <SubmitButton
          name="intent"
          value="publish"
          disabled={uploads.busy || uploads.failed}
          pendingLabel={t("post.publishing")}
        >
          {uploads.busy ? tAttachments("pending") : t("post.publish")}
        </SubmitButton>
        <SubmitButton
          name="intent"
          value="draft"
          variant="outline"
          disabled={uploads.busy || uploads.failed}
        >
          {t("post.draft")}
        </SubmitButton>
      </div>
    </form>
  );
}
