"use client";

import { CheckIcon, Loader2Icon, PencilIcon, Undo2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  type FocusEvent,
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { AttachmentPicker } from "@/components/forms/attachment-picker";
import { MarkdownEditor } from "@/components/forms/markdown-editor";
import { useUploads } from "@/components/forms/use-uploads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AttachmentView } from "@/lib/attachments";
import { addDays, type DateKey } from "@/lib/calendar/dates";
import { nextLessonDay, normalizeSubject, subjectTone, type TimetableSlot } from "@/lib/homework";
import { classMediaFolder, IMAGE_EDGES, UPLOAD_LIMITS } from "@/lib/uploads/shared";
import { cn } from "@/lib/utils";
import { type HomeworkFormState, saveHomework } from "@/server/actions/homework-publish";

import { TONE_CLASSES } from "./tones";

const initial: HomeworkFormState = { status: "idle" };

/**
 * Setting a homework, in the order a teacher thinks it: for when, in what, what to do — then
 * the page, photographed in one tap.
 *
 * It used to be the cahier de vie's composer with a select switched to « Devoir »: a date field
 * in the browser's own format, a free subject typed again every day, a photo field written for
 * class photos — with the image-rights attestation and the list of pupils to tag, which a page
 * of a revision book has no use for. Here the date is one tap on the coming school days (the
 * next lesson of the subject is marked, and chosen for you if you have not picked a day), the
 * subject one tap on those of the timetable, and the pages travel while the title is typed.
 */
export function HomeworkForm({
  classId,
  schoolId,
  postId,
  today,
  days,
  slots,
  subjects,
  otherClasses,
  returnTo,
  existing,
}: {
  classId: string;
  schoolId: string;
  /** Chosen by the server for a new homework, so its pages have a folder before it exists. */
  postId: string;
  today: DateKey;
  /** The next school days, for the « for when? » choices. */
  days: DateKey[];
  slots: TimetableSlot[];
  subjects: string[];
  otherClasses: Array<{ id: string; name: string }>;
  returnTo: "devoirs" | "classe";
  existing?: {
    title: string;
    bodyMd: string;
    subject: string | null;
    dueOn: string | null;
    visibility: "parents" | "staff";
    published: boolean;
    media: AttachmentView[];
  };
}) {
  const t = useTranslations("homeworkComposer");
  const tAttachments = useTranslations("attachments");
  const format = useFormatter();
  const router = useRouter();
  const id = useId();
  const [state, action, pending] = useActionState(saveHomework, initial);

  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [typingSubject, setTypingSubject] = useState(
    Boolean(existing?.subject) &&
      !subjects.some((s) => normalizeSubject(s) === normalizeSubject(existing?.subject ?? "")),
  );
  const [dueOn, setDueOn] = useState<string>(existing?.dueOn ?? days[0] ?? "");
  const [dueTouched, setDueTouched] = useState(Boolean(existing));
  const [otherDate, setOtherDate] = useState(
    Boolean(existing?.dueOn) && !days.includes(existing!.dueOn!),
  );
  const [kept, setKept] = useState(existing?.media ?? []);

  const uploads = useUploads({
    bucket: "class-media",
    folder: classMediaFolder(schoolId, classId, postId),
    maxFiles: UPLOAD_LIMITS.classMedia.maxFiles - kept.length,
    maxPdfBytes: UPLOAD_LIMITS.classMedia.maxPdfBytes,
    allowPdf: true,
    image: { maxEdge: IMAGE_EDGES.page, quality: 0.9 },
    normalisedByServer: true,
  });

  const lesson = useMemo(
    () => (subject ? nextLessonDay(slots, subject, today) : null),
    [slots, subject, today],
  );

  // The next lesson of the subject becomes the due date — until the teacher picks one herself.
  useEffect(() => {
    if (!dueTouched && lesson) {
      setDueOn(lesson);
      setOtherDate(!days.includes(lesson));
    }
  }, [lesson, dueTouched, days]);

  const handled = useRef<HomeworkFormState | null>(null);
  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === "success" && state.href) {
      toast.success(state.message);
      uploads.reset();
      router.push(state.href);
    }
  }, [state, router, uploads]);

  const dayChip = (day: DateKey) => {
    const tomorrow = day === addDays(today, 1);
    const date = new Date(`${day}T12:00:00Z`);
    return {
      top: tomorrow ? t("tomorrow") : format.dateTime(date, { weekday: "short", timeZone: "UTC" }),
      bottom: format.dateTime(date, { day: "numeric", month: "short", timeZone: "UTC" }),
      spoken: format.dateTime(date, {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }),
    };
  };

  const tone = TONE_CLASSES[subjectTone(subject)];
  const busy = uploads.busy;

  // SC 2.4.11. The pinned bar crosses the editor as soon as the form opens, and the browser
  // only scrolls a focused control that lies outside the window — one already inside it, under
  // the bar, stays hidden. Keyboard focus (and a text field) is brought back above the bar.
  const bar = useRef<HTMLDivElement>(null);
  const keepAboveBar = (event: FocusEvent<HTMLFormElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !bar.current || bar.current.contains(target)) return;
    requestAnimationFrame(() => {
      if (!target.matches(":focus-visible") || !bar.current) return;
      if (target.getBoundingClientRect().bottom > bar.current.getBoundingClientRect().top)
        target.scrollIntoView({ block: "nearest" });
    });
  };

  return (
    <form action={action} onFocus={keepAboveBar} className="flex flex-col gap-7">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="editing" value={existing ? "true" : "false"} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="dueOn" value={dueOn} />
      <input type="hidden" name="subject" value={subject} />
      {kept.map((media) => (
        <input key={media.id} type="hidden" name="keep" value={media.id} />
      ))}

      {/* ── For when ───────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-medium">{t("when")}</legend>
        <div className="flex flex-wrap gap-2">
          {days.map((day) => {
            const chip = dayChip(day);
            const selected = !otherDate && dueOn === day;
            const isLesson = lesson === day;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selected}
                aria-label={
                  isLesson ? t("dayWithLesson", { day: chip.spoken, subject }) : chip.spoken
                }
                onClick={() => {
                  setDueOn(day);
                  setOtherDate(false);
                  setDueTouched(true);
                }}
                className={cn(
                  "relative flex min-h-14 min-w-16 flex-col items-center justify-center rounded-md border px-2.5 py-1.5 transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_18%)] hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "text-xs font-semibold first-letter:uppercase",
                    !selected && "text-foreground/75",
                  )}
                >
                  {chip.top}
                </span>
                <span className="text-sm tabular-nums">{chip.bottom}</span>
                {isLesson && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full ring-2 ring-background",
                      tone.bar,
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-background" />
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={otherDate}
            onClick={() => {
              setOtherDate(true);
              setDueTouched(true);
            }}
            className={cn(
              "flex min-h-14 items-center rounded-md border px-3 text-sm font-medium transition-colors",
              otherDate
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground/80 hover:bg-muted",
            )}
          >
            {t("otherDate")}
          </button>
        </div>
        {lesson && subject && (
          <p className="text-xs text-muted-foreground">
            <span
              aria-hidden
              className={cn("mr-1.5 inline-block size-2 rounded-full align-middle", tone.bar)}
            />
            {t("nextLesson", {
              subject,
              day: format.dateTime(new Date(`${lesson}T12:00:00Z`), {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              }),
            })}
          </p>
        )}
        {otherDate && (
          <div className="flex flex-col gap-1.5 sm:max-w-56">
            <Label htmlFor={`${id}-date`}>{t("pickDate")}</Label>
            <Input
              id={`${id}-date`}
              type="date"
              min={today}
              value={otherDate ? dueOn : ""}
              onChange={(event) => setDueOn(event.target.value)}
              aria-invalid={state.field === "dueOn" || undefined}
              className="min-h-11"
            />
          </div>
        )}
      </fieldset>

      {/* ── Subject ────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-medium">
          {t("subject")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
        </legend>
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {subjects.map((name) => {
              const selected =
                !typingSubject && normalizeSubject(name) === normalizeSubject(subject);
              const classes = TONE_CLASSES[subjectTone(name)];
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setTypingSubject(false);
                    setSubject(selected ? "" : name);
                  }}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors md:min-h-9",
                    selected
                      ? "border-foreground/60 bg-muted font-semibold text-foreground"
                      : "border-border bg-card text-foreground/80 hover:bg-muted",
                  )}
                >
                  <span aria-hidden className={cn("size-2.5 rounded-full", classes.bar)} />
                  {name}
                  {selected && <CheckIcon aria-hidden className="size-3.5" />}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={typingSubject}
              onClick={() => {
                setTypingSubject(true);
                setSubject("");
              }}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-dashed px-3 text-sm font-medium transition-colors md:min-h-9",
                typingSubject
                  ? "border-foreground/60 bg-muted"
                  : "border-input text-foreground/80 hover:bg-muted",
              )}
            >
              <PencilIcon aria-hidden className="size-3.5" />
              {t("otherSubject")}
            </button>
          </div>
        )}
        {(typingSubject || subjects.length === 0) && (
          <Input
            aria-label={t("subject")}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={60}
            placeholder={t("subjectPlaceholder")}
            autoFocus={typingSubject && subjects.length > 0}
            className="min-h-11 sm:max-w-80"
          />
        )}
      </fieldset>

      {/* ── What to do ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-title`}>{t("what")}</Label>
        <Input
          id={`${id}-title`}
          name="title"
          required
          maxLength={200}
          defaultValue={existing?.title ?? ""}
          placeholder={t("whatPlaceholder")}
          aria-invalid={state.field === "title" || undefined}
          dir="auto"
          className="min-h-12 text-base"
        />
      </div>

      <MarkdownEditor
        name="bodyMd"
        label={
          <>
            {t("details")}{" "}
            <span className="font-normal text-muted-foreground">{t("optional")}</span>
          </>
        }
        rows={3}
        defaultValue={existing?.bodyMd ?? ""}
      />

      {/* ── Pages and documents ────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {kept.length > 0 || (existing?.media.length ?? 0) > 0 ? (
          <KeptFiles
            all={existing?.media ?? []}
            kept={kept}
            onToggle={(media) =>
              setKept((list) =>
                list.some((item) => item.id === media.id)
                  ? list.filter((item) => item.id !== media.id)
                  : [...list, media],
              )
            }
          />
        ) : null}
        <AttachmentPicker
          uploads={uploads}
          label={t("pages")}
          hint={t("pagesHint")}
          cameraLabel={tAttachments("takePage")}
          allowPdf
          rotatable
        />
      </div>

      {/* ── The same homework elsewhere ────────────────────────── */}
      {!existing && otherClasses.length > 0 && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1.5 text-sm font-medium">{t("alsoFor")}</legend>
          <p className="mb-1 text-xs text-muted-foreground">{t("alsoForHint")}</p>
          <div className="flex flex-wrap gap-x-5">
            {otherClasses.map((cls) => (
              <label key={cls.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="alsoFor"
                  value={cls.id}
                  className="size-5 accent-primary"
                />
                {cls.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <details className="group/options rounded-md border border-rule">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium">
          {t("options")}
          <span className="text-xs font-normal text-muted-foreground group-open/options:hidden">
            {t("optionsHint")}
          </span>
        </summary>
        <div className="flex flex-col gap-2 border-t border-rule px-3 py-3">
          <Label htmlFor={`${id}-visibility`}>{t("visibility")}</Label>
          <select
            id={`${id}-visibility`}
            name="visibility"
            defaultValue={existing?.visibility ?? "parents"}
            className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm sm:max-w-72"
          >
            <option value="parents">{t("visibilityParents")}</option>
            <option value="staff">{t("visibilityStaff")}</option>
          </select>
        </div>
      </details>

      {state.status === "error" && state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      {uploads.failed && (
        <p role="alert" className="text-sm text-destructive">
          {tAttachments("failedHint")}
        </p>
      )}

      {/* One row, pinned above the tab bar: a quick homework — a day, a line — is published
          without scrolling to the end of the form. `data-pinned-actions` widens the page's
          scroll padding by the bar's height (globals.css), or a control reached with Tab would
          stop underneath it. */}
      <div
        ref={bar}
        data-pinned-actions
        className="sticky bottom-[calc(var(--nav-h)+0.5rem)] z-10 -mx-1 flex items-center gap-2 rounded-lg bg-background p-1 lg:bottom-2"
      >
        {!existing?.published && (
          <Button
            type="submit"
            name="intent"
            value="draft"
            variant="outline"
            disabled={pending || busy || uploads.failed}
            className="min-h-12"
          >
            <span className="sm:hidden">{t("draftShort")}</span>
            <span className="hidden sm:inline">{t("draft")}</span>
          </Button>
        )}
        <Button
          type="submit"
          name="intent"
          value="publish"
          disabled={pending || busy || uploads.failed}
          className="min-h-12 flex-1 text-[0.9375rem] sm:flex-none sm:px-6"
        >
          {(pending || busy) && <Loader2Icon aria-hidden className="animate-spin" />}
          {busy ? tAttachments("pending") : existing?.published ? t("saveChanges") : t("publish")}
        </Button>
      </div>
    </form>
  );
}

/** Files already joined to the homework being edited: each one can be taken off, or kept. */
function KeptFiles({
  all,
  kept,
  onToggle,
}: {
  all: AttachmentView[];
  kept: AttachmentView[];
  onToggle: (media: AttachmentView) => void;
}) {
  const t = useTranslations("homeworkComposer");
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{t("joined")}</p>
      <ul className="flex flex-wrap gap-2">
        {all.map((media) => {
          const keeping = kept.some((item) => item.id === media.id);
          return (
            <li
              key={media.id}
              className={cn(
                "relative flex h-32 w-24 flex-col overflow-hidden rounded-md border border-border bg-muted",
                !keeping && "opacity-45",
              )}
            >
              {media.kind === "image" && media.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a signed URL from a private bucket
                <img src={media.thumbUrl} alt={media.name} className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-end bg-card p-2 text-xs font-medium break-all">
                  {media.name}
                </span>
              )}
              <button
                type="button"
                onClick={() => onToggle(media)}
                aria-pressed={!keeping}
                aria-label={
                  keeping
                    ? t("removeJoined", { name: media.name })
                    : t("keepJoined", { name: media.name })
                }
                className="absolute top-0 right-0 flex size-11 items-start justify-end p-1.5"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-background/90 shadow-soft ring-1 ring-border">
                  {keeping ? (
                    <XIcon aria-hidden className="size-3.5" />
                  ) : (
                    <Undo2Icon aria-hidden className="size-3.5" />
                  )}
                </span>
              </button>
              {!keeping && (
                <span className="absolute inset-x-0 bottom-0 bg-background/90 px-1.5 py-1 text-[0.6875rem] font-medium text-destructive">
                  {t("willBeRemoved")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
