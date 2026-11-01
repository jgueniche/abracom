import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import QRCode from "qrcode";

import { FilterChip, FilterChips } from "@/components/domain/filter-chip";
import { AnswerKey } from "@/components/domain/practice/answer-key";
import { AnswerKeyList, ExerciseBlock } from "@/components/domain/practice/exercises";
import { cursive, hebrew } from "@/components/domain/practice/fonts";
import { NameLine } from "@/components/domain/practice/name-line";
import { PictogramDefs } from "@/components/domain/practice/pictogram";
import { ClassPracticeSwitch, TeamControls } from "@/components/domain/practice/team-controls";
import { PracticeWaiting } from "@/components/domain/practice/waiting";
import { PrintButton } from "@/components/domain/print-button";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/components/ui/link";
import { requireCurrentUser } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { isSchoolStaff } from "@/lib/permissions";
import { audioClips } from "@/lib/practice/answers";
import {
  LEVEL_SLUGS,
  levelFromSlug,
  NO_PICTOGRAM,
  type PictogramKey,
  PRACTICE_LEVELS,
  type StoredSheet,
} from "@/lib/practice/schema";
import { cn } from "@/lib/utils";
import { getHomework, isClassTeacher } from "@/server/queries/class-space";
import { getMyChildren } from "@/server/queries/family";
import { getPracticeSheet, getPracticeState, isStalePending } from "@/server/queries/practice";

/**
 * The request that opens this page starts the preparation, and `after()` keeps the instance
 * alive until the sheet is written — half a minute, a minute at worst (ADR-0087).
 */
export const maxDuration = 120;

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const [t, homework] = await Promise.all([
    getTranslations("practice"),
    UUID.test(postId) ? getHomework(postId) : null,
  ]);
  return { title: homework ? `${t("page.title")} — ${homework.title}` : t("page.title") };
}

/**
 * « S'entraîner » — a practice sheet prepared by AI from a homework (ADR-0087).
 *
 * Read by the families of the class and its team: the sheet is under the homework's own
 * policies, and this page sends anyone else away. Three states: being prepared (the page asks
 * on arrival and follows the job), ready (the sheet, on screen and for the printer), or not
 * offered — said in so many words, never a silent redirect.
 */
export default async function PracticePage({
  params,
}: {
  params: Promise<{ postId: string; level: string }>;
}) {
  const [{ postId, level: slug }, user] = await Promise.all([params, requireCurrentUser()]);
  const level = levelFromSlug(slug);
  if (!UUID.test(postId) || !level) notFound();
  const [t, locale, homework, children] = await Promise.all([
    getTranslations("practice"),
    getLocale(),
    getHomework(postId),
    getMyChildren(),
  ]);
  if (!homework || !homework.due_on || !homework.published_at) notFound();

  const schoolId = homework.class?.school_id ?? homework.school_id;
  const [teaches, state, view] = await Promise.all([
    isClassTeacher(homework.class_id, user.id),
    getPracticeState(user, { ...homework, school_id: schoolId }),
    getPracticeSheet(postId, level),
  ]);
  const team = teaches || isSchoolStaff(user.roles, schoolId);
  const names = [
    ...new Set(
      children
        .map((row) => row.student)
        .filter((student) => student.enrollments.some((e) => e.class?.id === homework.class_id))
        .map((student) => student.first_name),
    ),
  ];
  if (!team && names.length === 0) notFound();

  const sheet = view?.sheet ?? null;
  const context = [homework.subject, homework.class?.name].filter(Boolean).join(" · ");

  return (
    <Column width="text">
      <Link
        href={`/devoirs/${homework.id}`}
        className="no-print mb-3 -ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-foreground/75 hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        {t("page.back")}
      </Link>
      <PageHeader
        eyebrow={[t("page.eyebrow"), context].filter(Boolean).join(" · ")}
        title={sheet?.title ?? t("page.title")}
        caption={t("page.fromHomework", { title: homework.title })}
        actions={sheet ? <PrintButton /> : undefined}
      />

      <FilterChips label={t("page.levelsLabel")} className="no-print">
        {PRACTICE_LEVELS.map((value) => (
          <FilterChip
            key={value}
            href={`/devoirs/${homework.id}/entrainement/${LEVEL_SLUGS[value]}`}
            active={value === level}
          >
            {t(`levels.${value}`)}
          </FilterChip>
        ))}
      </FilterChips>

      <div className="mt-4">
        {!state.installed ? (
          <Notice>{t("errors.unavailable")}</Notice>
        ) : sheet && view ? (
          <>
            <SheetDocument
              sheet={sheet}
              seed={view.row.id}
              names={names}
              illustrationUrl={view.illustrationUrl}
              audioUrls={view.audioUrls}
              qr={await qrCodes(sheet, `/devoirs/${homework.id}/entrainement/${slug}`)}
              beta={view.row.beta}
              model={view.row.model}
              locale={locale}
            />
            {team && (
              <TeamControls
                sheetId={view.row.id}
                postId={homework.id}
                classId={homework.class_id}
                hidden={view.row.hidden_at !== null}
              />
            )}
          </>
        ) : !state.offered ? (
          <Notice>
            {t("errors.closed")}
            {team && !state.classEnabled && (
              <span className="mt-2 -ml-3 block">
                <ClassPracticeSwitch
                  classId={homework.class_id}
                  postId={homework.id}
                  enabled={false}
                  label={t("launcher.reopen")}
                />
              </span>
            )}
          </Notice>
        ) : (
          <PracticeWaiting
            postId={homework.id}
            level={level}
            status={view?.row.status === "ready" ? null : (view?.row.status ?? null)}
            stage={view?.row.stage ?? null}
            mustRequest={!view || isStalePending(view.row)}
          />
        )}
      </div>
    </Column>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="rounded-lg bg-muted px-5 py-4 text-[0.9375rem]">
      {children}
    </div>
  );
}

async function SheetDocument({
  sheet,
  seed,
  names,
  illustrationUrl,
  audioUrls,
  qr,
  beta,
  model,
  locale,
}: {
  sheet: StoredSheet;
  seed: string;
  names: string[];
  illustrationUrl: string | null;
  audioUrls: Record<string, string>;
  qr: Record<string, string>;
  beta: boolean;
  model: string | null;
  locale: string;
}) {
  const t = await getTranslations("practice.page");
  const labels = {
    exercise: (number: number) => t("exercise", { number }),
    listen: t("listen"),
    listenWord: (word: string) => t("listenWord", { word }),
    stop: t("stop"),
    scan: t("scan"),
    questions: t("questions"),
    word: (number: number) => t("word", { number }),
    right: t("right"),
    retry: t("retry"),
  };
  return (
    <div className={cn(cursive.variable, hebrew.variable)}>
      <PictogramDefs keys={pictogramsOf(sheet)} />
      {beta && (
        <p
          role="note"
          className="mb-5 flex items-start gap-2 rounded-lg bg-muted px-4 py-3 text-sm"
        >
          <Badge variant="secondary" className="mt-0.5">
            {t("betaShort")}
          </Badge>
          <span className="text-pretty">{t("betaNotice")}</span>
        </p>
      )}
      {illustrationUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a signed URL from a private bucket
        <img
          src={illustrationUrl}
          alt={t("illustrationAlt")}
          width={1400}
          height={788}
          className="mb-5 aspect-video w-full rounded-lg bg-muted object-cover print:max-h-56"
        />
      )}
      <NameLine
        names={names}
        nameLabel={t("name")}
        dateLabel={t("date")}
        forLabel={t("nameFor")}
        nobodyLabel={t("nobody")}
      />
      <p className="mb-8 font-heading text-lg text-pretty italic">{sheet.intro}</p>

      {sheet.exercises.map((exercise, index) => (
        <ExerciseBlock
          key={index}
          exercise={exercise}
          index={index}
          context={{ audio: audioUrls, qr, seed, locale, labels }}
        />
      ))}

      <section className="mt-10 break-inside-avoid" aria-labelledby="practice-tip">
        <SectionHeader id="practice-tip" label={t("tip")} />
        <p className="text-sm text-pretty">{sheet.parentTip}</p>
      </section>

      <AnswerKey showLabel={t("showKey")} hideLabel={t("hideKey")}>
        <SectionHeader label={t("key")} />
        <AnswerKeyList exercises={sheet.exercises} locale={locale} labels={labels} />
      </AnswerKey>

      <p className="mt-10 text-xs text-pretty text-muted-foreground">
        {t("disclosure", { model: model ?? "Gemini" })}
      </p>
    </div>
  );
}

function pictogramsOf(sheet: StoredSheet): PictogramKey[] {
  return sheet.exercises.flatMap((exercise) => {
    if (exercise.kind === "count") return exercise.items.map((item) => item.pictogram);
    if (exercise.kind === "match") return exercise.pairs.map((pair) => pair.pictogram);
    if (exercise.kind === "operations" && exercise.pictogram !== NO_PICTOGRAM)
      return [exercise.pictogram];
    return [];
  });
}

/** A QR code beside each exercise that has a voice, back to it on this page — for paper. */
async function qrCodes(sheet: StoredSheet, path: string): Promise<Record<string, string>> {
  const withVoice = new Set(audioClips(sheet).map((clip) => clip.id.split("-")[0]!));
  const out: Record<string, string> = {};
  await Promise.all(
    [...withVoice].map(async (id) => {
      if (!Object.keys(sheet.audio).some((clip) => clip === id || clip.startsWith(`${id}-`)))
        return;
      const url = `${publicEnv.NEXT_PUBLIC_SITE_URL}${path}#exercice-${id.slice(2)}`;
      out[id] = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
    }),
  );
  return out;
}
