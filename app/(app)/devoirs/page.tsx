import { BookOpenIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { MetaChip } from "@/components/domain/content-card";
import { NewHomeworkButton } from "@/components/domain/new-homework-button";
import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { canWriteInSchool } from "@/lib/permissions";
import { plainExcerpt } from "@/lib/text";
import { cn } from "@/lib/utils";
import { toggleHomeworkSeen } from "@/server/actions/class-posts";
import { getHomeworkDiary } from "@/server/queries/class-space";
import { getMyTeachingClasses } from "@/server/queries/classes";
import { getMyChildren } from "@/server/queries/family";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("diary");
  return { title: t("title") };
}

const DAY_MS = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Monday of the week containing `date`, at noon UTC so no timezone shifts the day. */
function mondayOf(date: Date): Date {
  const monday = new Date(date);
  monday.setUTCHours(12, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday;
}

type Child = { id: string; firstName: string; className: string };

/**
 * The homework diary — one chronological page, every class of the reader merged.
 *
 * Homework already existed, but only inside a single class and bucketed as
 * "overdue / this week / later". A parent with two children in two classes had
 * to open two tabs to answer the one question a weekday evening asks: what is
 * there to prepare. Here the week is the spine, the class is a label, and a
 * parent of several children can narrow to one of them.
 */
export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string; enfant?: string }>;
}) {
  const [{ semaine, enfant }, user] = await Promise.all([searchParams, requireCurrentUser()]);
  const [t, format, children, teaching] = await Promise.all([
    getTranslations("diary"),
    getFormatter(),
    getMyChildren(),
    getMyTeachingClasses(user.id),
  ]);

  const asked =
    semaine && /^\d{4}-\d{2}-\d{2}$/.test(semaine) ? new Date(`${semaine}T12:00:00Z`) : new Date();
  const monday = mondayOf(Number.isNaN(asked.getTime()) ? new Date() : asked);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  const today = new Date();
  const todayIso = iso(today);
  const tomorrowIso = iso(new Date(today.getTime() + DAY_MS));
  const isCurrentWeek = iso(mondayOf(today)) === iso(monday);

  // A guardian is linked to their children through student_guardians, and each
  // child to a class through enrollments — so one reader can span several
  // classes, and one class can concern two of their children (siblings).
  const allChildren = children.map((row) => row.student);
  const selected = allChildren.find((child) => child.id === enfant)?.id ?? null;
  const shown = selected ? allChildren.filter((child) => child.id === selected) : allChildren;

  const childrenByClass = new Map<string, Child[]>();
  const classNames = new Map<string, string>();
  for (const child of shown)
    for (const enrolment of child.enrollments) {
      if (!enrolment.class) continue;
      classNames.set(enrolment.class.id, enrolment.class.name);
      childrenByClass.set(enrolment.class.id, [
        ...(childrenByClass.get(enrolment.class.id) ?? []),
        { id: child.id, firstName: child.first_name, className: enrolment.class.name },
      ]);
    }
  for (const row of teaching) if (row.class) classNames.set(row.class.id, row.class.name);

  const classIds = [...classNames.keys()];
  const entries = await getHomeworkDiary(classIds, iso(monday), iso(sunday));

  const byDay = new Map<string, typeof entries>();
  for (const entry of entries) {
    if (!entry.due_on) continue;
    byDay.set(entry.due_on, [...(byDay.get(entry.due_on) ?? []), entry]);
  }
  // Monday to Friday always — an empty Thursday is information; the weekend
  // only when something is actually due on it.
  const days = Array.from({ length: 7 }, (_, index) =>
    iso(new Date(monday.getTime() + index * DAY_MS)),
  ).filter((day, index) => index < 5 || (byDay.get(day)?.length ?? 0) > 0);

  const canTick = user.school ? canWriteInSchool(user.roles, user.school.id) : false;
  const teacherView = teaching.length > 0 && allChildren.length === 0;
  const myClasses = teaching.flatMap((row) =>
    row.class ? [{ id: row.class.id, name: row.class.name }] : [],
  );
  const childHref = (id: string | null) => {
    const params = new URLSearchParams();
    if (!isCurrentWeek) params.set("semaine", iso(monday));
    if (id) params.set("enfant", id);
    const query = params.toString();
    return query ? `/devoirs?${query}` : "/devoirs";
  };
  const weekHref = (offset: number) => {
    const params = new URLSearchParams({
      semaine: iso(new Date(monday.getTime() + offset * 7 * DAY_MS)),
    });
    if (selected) params.set("enfant", selected);
    return `/devoirs?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow={t("week", {
          from: format.dateTime(monday, { day: "numeric", month: "long" }),
          to: format.dateTime(sunday, { day: "numeric", month: "long" }),
        })}
        title={t("title")}
        description={teacherView ? t("subtitleTeacher") : t("subtitle")}
        actions={
          <>
            <NewHomeworkButton classes={myClasses} />
            <Button asChild variant="outline" size="icon" className="size-11">
              <Link href={weekHref(-1)} aria-label={t("previousWeek")}>
                <ChevronLeftIcon aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              variant={isCurrentWeek ? "secondary" : "default"}
              className="min-h-11"
              aria-current={isCurrentWeek ? "true" : undefined}
            >
              <Link href={childHref(selected)}>{t("thisWeek")}</Link>
            </Button>
            <Button asChild variant="outline" size="icon" className="size-11">
              <Link href={weekHref(1)} aria-label={t("nextWeek")}>
                <ChevronRightIcon aria-hidden />
              </Link>
            </Button>
          </>
        }
      />

      {allChildren.length > 1 && (
        <nav aria-label={t("title")} className="-mt-2 mb-4 flex flex-wrap gap-2">
          {[null, ...allChildren.map((child) => child.id)].map((id) => {
            const child = allChildren.find((item) => item.id === id);
            const active = selected === id;
            return (
              <Link
                key={id ?? "all"}
                href={childHref(id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-full border px-4 text-sm font-medium",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {child ? child.first_name : t("allChildren")}
              </Link>
            );
          })}
        </nav>
      )}

      {classIds.length === 0 ? (
        <EmptyState icon={BookOpenIcon} title={t("noClass")} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {t("weekCount", { count: entries.length })}
          </p>
          {entries.length === 0 ? (
            <EmptyState icon={BookOpenIcon} title={t("empty")} description={t("emptyHint")} />
          ) : (
            <ol className="flex flex-col gap-3 2xl:grid 2xl:grid-cols-2 2xl:gap-4">
              {days.map((day) => {
                const items = byDay.get(day) ?? [];
                const isToday = day === todayIso;
                const isTomorrow = day === tomorrowIso;
                const isPast = day < todayIso;
                const empty = items.length === 0;
                return (
                  <li
                    key={day}
                    className={cn(
                      "rounded-2xl border",
                      empty
                        ? "border-dashed border-border/70 px-4 py-2.5"
                        : "bg-card p-4 shadow-soft",
                      isToday && !empty && "border-primary/60 ring-1 ring-primary/25",
                      isToday && empty && "border-primary/40",
                      !isToday && !empty && "border-border",
                      isPast && empty && "opacity-55",
                    )}
                  >
                    <p
                      className={cn(
                        "flex flex-wrap items-baseline gap-x-2 gap-y-1",
                        !empty && "mb-3",
                      )}
                    >
                      <span
                        className={cn(
                          "font-heading tracking-tight first-letter:uppercase",
                          empty ? "text-base text-muted-foreground" : "text-lg",
                          isToday && "text-primary",
                        )}
                      >
                        {format.dateTime(new Date(`${day}T12:00:00Z`), {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                      {isToday && <span className="eyebrow text-primary">{t("today")}</span>}
                      {isTomorrow && <span className="eyebrow">{t("dueTomorrow")}</span>}
                      {isPast && !empty && <span className="eyebrow text-brick">{t("late")}</span>}
                      {empty && (
                        <span className="text-sm text-muted-foreground">{t("nothingToday")}</span>
                      )}
                    </p>

                    {empty ? null : (
                      <ul className="flex flex-col gap-4">
                        {items.map((entry) => {
                          const concerned = childrenByClass.get(entry.class_id) ?? [];
                          return (
                            <li key={entry.id} className="border-l-2 border-primary/40 pl-3">
                              <p className="eyebrow mb-0.5 flex flex-wrap items-center gap-x-2">
                                <span className="text-primary">
                                  {classNames.get(entry.class_id) ?? ""}
                                </span>
                                {entry.subject && <span>· {entry.subject}</span>}
                                {concerned.length > 0 && allChildren.length > 1 && (
                                  <span>
                                    ·{" "}
                                    {t("forChild", {
                                      name: concerned.map((child) => child.firstName).join(", "),
                                    })}
                                  </span>
                                )}
                              </p>
                              <p className="font-medium">{entry.title}</p>
                              {entry.body_md && (
                                <p className="prose-kesher mt-0.5 line-clamp-3 text-[0.9375rem]">
                                  {plainExcerpt(entry.body_md, 240)}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {/* a read-only guardian sees the homework but cannot tick it */}
                                {!teacherView &&
                                  canTick &&
                                  concerned.map((child) => {
                                    const done = entry.completions.some(
                                      (completion) => completion.student_id === child.id,
                                    );
                                    return (
                                      <form key={child.id} action={toggleHomeworkSeen}>
                                        <input type="hidden" name="postId" value={entry.id} />
                                        <input type="hidden" name="studentId" value={child.id} />
                                        <input
                                          type="hidden"
                                          name="classId"
                                          value={entry.class_id}
                                        />
                                        <input type="hidden" name="done" value={String(done)} />
                                        <Button
                                          type="submit"
                                          size="sm"
                                          variant={done ? "secondary" : "outline"}
                                          className="min-h-11"
                                          aria-pressed={done}
                                        >
                                          <CheckIcon
                                            aria-hidden
                                            className={cn(!done && "opacity-40")}
                                          />
                                          {child.firstName}
                                        </Button>
                                      </form>
                                    );
                                  })}
                                {teacherView && (
                                  <MetaChip>
                                    {t("seenBy", { count: entry.completions.length })}
                                  </MetaChip>
                                )}
                                <Button asChild variant="ghost" size="sm" className="min-h-11">
                                  <Link href={`/classes/${entry.class_id}/devoirs`}>
                                    {t("openClass")}
                                  </Link>
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </>
  );
}
