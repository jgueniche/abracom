import { getFormatter, getTranslations } from "next-intl/server";

import { AttachmentStrip } from "@/components/domain/attachment-strip";
import { EmptyState } from "@/components/domain/empty-state";
import { Markdown } from "@/components/domain/markdown";
import { PostActions } from "@/components/domain/post-actions";
import { SectionHeader } from "@/components/layouts/section-header";
import { Link } from "@/components/ui/link";
import type { AttachmentView } from "@/lib/attachments";
import { addDays, type DateKey } from "@/lib/calendar/dates";
import { doneKey, subjectTone, weekDays } from "@/lib/homework";
import { plainExcerpt } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { DiaryEntry } from "@/server/queries/class-space";

import { DoneToggle } from "./done-toggle";
import { HomeworkProgress } from "./progress";
import { TONE_CLASSES } from "./tones";
import {
  DayCelebration,
  DayProgress,
  EntryFrame,
  type StripDay,
  WeekProgress,
  WeekStrip,
} from "./week-parts";

/** Past this many characters the details fold behind « Lire la suite ». */
const FOLD_AT = 280;

export type WeekReader = {
  /** The reader's own children, by class — never the class's pupils (ADR-0059). */
  childrenByClass: ReadonlyMap<string, ReadonlyArray<{ id: string; firstName: string }>>;
  /** A parent who may write: ticks « Fait ». A read-only guardian sees the ticks. */
  canTick: boolean;
  /** Classes whose homework the reader follows as a team: counts and the edit menu. */
  teamClassIds: ReadonlySet<string>;
  /** Pupils per class, for « Fait : 12 / 24 ». */
  classSizes: ReadonlyMap<string, number>;
  userId: string;
  /** The direction edits anyone's publication (RLS `class_posts_update`). */
  isAdmin: boolean;
  /** In the merged diary every entry names its class; in a class's own tab it would repeat. */
  showClass: boolean;
};

/**
 * One week of homework — the diary's and each class tab's, which used to be two different
 * layouts of the same thing.
 *
 * The week reads from the day being prepared: in the current week the list opens on that day,
 * named the way a parent says it (« Pour demain »), even when there is nothing to prepare — that
 * is worth saying too; the days after follow; the days already handed in fold under « Plus tôt
 * cette semaine ». Any other week reads in calendar order.
 */
export async function HomeworkWeek({
  monday,
  pivot,
  today,
  entries,
  attachments,
  reader,
  emptyAction,
}: {
  monday: DateKey;
  /** The day being prepared, when it falls in this week. */
  pivot: DateKey | null;
  today: DateKey;
  entries: DiaryEntry[];
  attachments: ReadonlyMap<string, AttachmentView>;
  reader: WeekReader;
  emptyAction?: React.ReactNode;
}) {
  const [t, format] = await Promise.all([getTranslations("diary"), getFormatter()]);

  const byDay = new Map<DateKey, DiaryEntry[]>();
  for (const entry of entries) {
    if (!entry.due_on) continue;
    byDay.set(entry.due_on, [...(byDay.get(entry.due_on) ?? []), entry]);
  }
  const days = weekDays(monday, new Set(byDay.keys()));

  const keysOf = (entry: DiaryEntry) =>
    (reader.childrenByClass.get(entry.class_id) ?? []).map((child) => doneKey(entry.id, child.id));
  const dayKeys = (day: DateKey) => (byDay.get(day) ?? []).flatMap(keysOf);
  const ticks = reader.childrenByClass.size > 0;
  const doneKeys = entries.flatMap((entry) =>
    entry.completions
      .filter((completion) =>
        (reader.childrenByClass.get(entry.class_id) ?? []).some(
          (child) => child.id === completion.student_id,
        ),
      )
      .map((completion) => doneKey(entry.id, completion.student_id)),
  );

  const dayLabel = (day: DateKey, style: "long" | "short" = "long") =>
    format.dateTime(new Date(`${day}T12:00:00Z`), {
      weekday: "long",
      day: "numeric",
      month: style === "long" ? "long" : undefined,
      timeZone: "UTC",
    });

  const strip: StripDay[] = days.map((day) => ({
    day,
    weekday: format.dateTime(new Date(`${day}T12:00:00Z`), { weekday: "short", timeZone: "UTC" }),
    date: format.dateTime(new Date(`${day}T12:00:00Z`), { day: "numeric", timeZone: "UTC" }),
    label: dayLabel(day),
    count: byDay.get(day)?.length ?? 0,
    keys: dayKeys(day),
    pivot: day === pivot,
    today: day === today,
    past: pivot ? day < pivot : day < today,
  }));

  // The current week opens on the day being prepared; past days fold underneath.
  const upcoming = pivot ? days.filter((day) => day >= pivot) : days;
  const earlier = pivot ? days.filter((day) => day < pivot) : [];
  const visible = (list: DateKey[]) =>
    list.filter((day) => day === pivot || (byDay.get(day)?.length ?? 0) > 0);

  const pivotName =
    pivot === today
      ? t("forToday")
      : pivot === addDays(today, 1)
        ? t("forTomorrow")
        : pivot
          ? t("forWeekday", {
              day: format.dateTime(new Date(`${pivot}T12:00:00Z`), {
                weekday: "long",
                timeZone: "UTC",
              }),
            })
          : "";

  const renderDay = (day: DateKey, muted = false) => {
    const items = byDay.get(day) ?? [];
    const isPivot = day === pivot;
    const keys = dayKeys(day);
    return (
      <section
        key={day}
        id={`jour-${day}`}
        aria-labelledby={`jour-${day}-titre`}
        className="scroll-mt-24"
      >
        <SectionHeader
          id={`jour-${day}-titre`}
          label={
            isPivot ? (
              <>
                <span className="text-primary">{pivotName}</span>
                <span className="font-normal tracking-normal text-muted-foreground normal-case">
                  {" · "}
                  {dayLabel(day)}
                </span>
              </>
            ) : (
              <span className={cn(muted && "text-muted-foreground")}>{dayLabel(day)}</span>
            )
          }
          count={ticks && keys.length > 0 ? <DayProgress keys={keys} /> : undefined}
          className="mb-1"
        />
        {isPivot && keys.length > 0 && (
          <DayCelebration
            keys={keys}
            message={pivot === today ? t("readyToday") : t("readyNext", { day: pivotName })}
          />
        )}
        {items.length === 0 ? (
          <p className="pb-2 text-sm text-muted-foreground">
            {isPivot ? t("nothingForPivot", { day: pivotName.toLowerCase() }) : t("nothingToday")}
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            {items.map((entry) => (
              <li key={entry.id}>
                <HomeworkEntry
                  entry={entry}
                  keys={keysOf(entry)}
                  attachments={entry.media.flatMap((media) => {
                    const view = attachments.get(media.id);
                    return view ? [view] : [];
                  })}
                  reader={reader}
                  muted={muted}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  const upcomingDays = visible(upcoming);
  const earlierDays = visible(earlier);

  return (
    <HomeworkProgress doneKeys={doneKeys}>
      <div className="mb-6">
        <WeekStrip days={strip} ticks={ticks} />
        {ticks && <WeekProgress keys={strip.flatMap((day) => day.keys)} />}
      </div>

      {entries.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyHint")} action={emptyAction} />
      ) : (
        <div className="flex flex-col gap-7">
          {upcomingDays.map((day) => renderDay(day))}
          {earlierDays.length > 0 && (
            <div className="flex flex-col gap-5">
              <p className="eyebrow border-t border-rule pt-5">{t("earlierThisWeek")}</p>
              {earlierDays.map((day) => renderDay(day, true))}
            </div>
          )}
        </div>
      )}
    </HomeworkProgress>
  );
}

async function HomeworkEntry({
  entry,
  keys,
  attachments,
  reader,
  muted,
}: {
  entry: DiaryEntry;
  keys: string[];
  attachments: AttachmentView[];
  reader: WeekReader;
  muted: boolean;
}) {
  const t = await getTranslations("diary");
  const tone = subjectTone(entry.subject);
  const classes = TONE_CLASSES[tone];
  const concerned = reader.childrenByClass.get(entry.class_id) ?? [];
  const team = reader.teamClassIds.has(entry.class_id);
  const canEdit = team && (entry.author_id === reader.userId || reader.isAdmin);
  const isDraft = entry.published_at === null;
  const body = entry.body_md ?? "";
  const size = reader.classSizes.get(entry.class_id);
  const href = `/devoirs/${entry.id}`;

  // One child: the ring stands beside the title. Several in the same class: one per child,
  // each named, under the homework.
  const single = concerned.length === 1 ? concerned[0]! : null;
  const several = concerned.length > 1;

  return (
    <EntryFrame keys={keys} id={`devoir-${entry.id}`} className="flex gap-3 py-3.5">
      <div className="flex w-7 shrink-0 items-start justify-center pt-0.5">
        {single ? (
          <DoneToggle
            postId={entry.id}
            studentId={single.id}
            title={entry.title}
            tone={tone}
            childName={single.firstName}
            readOnly={!reader.canTick}
          />
        ) : (
          // The team, and a parent with several children here: the subject's stroke alone.
          <span
            aria-hidden
            className={cn("mt-1 block h-[calc(100%-0.5rem)] w-[3px] rounded-full", classes.bar)}
          />
        )}
      </div>
      <div className={cn("min-w-0 flex-1", muted && "opacity-90")}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="eyebrow flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              {entry.subject && <span className="text-foreground/80">{entry.subject}</span>}
              {reader.showClass && entry.class && (
                <>
                  {entry.subject && <span aria-hidden>·</span>}
                  <span>{entry.class.name}</span>
                </>
              )}
              {several && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {t("forChild", { name: concerned.map((c) => c.firstName).join(", ") })}
                  </span>
                </>
              )}
              {isDraft && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-brick">{t("draft")}</span>
                </>
              )}
              {entry.visibility === "staff" && (
                <>
                  <span aria-hidden>·</span>
                  <span>{t("teamOnly")}</span>
                </>
              )}
            </p>
            <h3 className="mt-0.5 font-heading text-base leading-snug font-normal tracking-[-0.006em] text-pretty transition-colors group-data-[done]/entry:text-muted-foreground">
              <Link
                href={href}
                dir="auto"
                className="decoration-foreground/25 underline-offset-[3px] group-data-[done]/entry:line-through group-data-[done]/entry:decoration-muted-foreground/50 hover:underline"
              >
                {entry.title}
              </Link>
            </h3>
          </div>
          {canEdit && <PostActions postId={entry.id} editHref={`/devoirs/${entry.id}/modifier`} />}
        </div>

        {body &&
          (body.length > FOLD_AT ? (
            <details className="group/body mt-1">
              <summary className="cursor-pointer list-none">
                <span
                  dir="auto"
                  className="block text-sm text-pretty text-foreground/80 group-open/body:hidden"
                >
                  {plainExcerpt(body, 220)}
                </span>
                <span className="mt-0.5 inline-flex min-h-8 items-center text-sm font-semibold text-primary group-open/body:hidden">
                  {t("readMore")}
                </span>
              </summary>
              <div dir="auto">
                <Markdown size="compact">{body}</Markdown>
              </div>
            </details>
          ) : (
            <div dir="auto" className="mt-1">
              <Markdown size="compact">{body}</Markdown>
            </div>
          ))}

        {attachments.length > 0 && (
          <AttachmentStrip items={attachments} title={entry.title} className="mt-2.5" />
        )}

        {(several || team) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {several &&
              concerned.map((child) => (
                <DoneToggle
                  key={child.id}
                  postId={entry.id}
                  studentId={child.id}
                  title={entry.title}
                  tone={tone}
                  childName={child.firstName}
                  showName
                  size="sm"
                  readOnly={!reader.canTick}
                />
              ))}
            {team && !isDraft && size !== undefined && (
              <TeamCount done={entry.completions.length} total={size} />
            )}
          </div>
        )}
      </div>
    </EntryFrame>
  );
}

/** « Fait : 12 / 24 » and a rule that fills — what the teacher sees instead of a ring. */
async function TeamCount({ done, total }: { done: number; total: number }) {
  const t = await getTranslations("diary");
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <span className="flex min-h-8 items-center gap-2 text-xs text-muted-foreground tabular-nums">
      <span aria-hidden className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
      </span>
      {t("doneByTotal", { count: done, total })}
    </span>
  );
}
