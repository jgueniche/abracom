import { BookOpenIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { HomeworkWeek } from "@/components/domain/homework/homework-week";
import { DiaryChildFilter } from "@/components/domain/homework/selection";
import { WeekNav } from "@/components/domain/homework/week-nav";
import { NewHomeworkButton } from "@/components/domain/new-homework-button";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { requireCurrentUser } from "@/lib/auth/session";
import { addDays, isDateKey, localDateKey, mondayOf } from "@/lib/calendar/dates";
import { defaultWeek, pivotDay, SCHOOL_TIME_ZONE, weekDays } from "@/lib/homework";
import { canWriteInSchool, isSchoolAdmin } from "@/lib/permissions";
import { attachmentViews } from "@/server/queries/attachments";
import { getClassSizes, getHomeworkDiary, getNextHomeworkDay } from "@/server/queries/class-space";
import { getPracticeClassIds } from "@/server/queries/practice";
import { getMyTeachingClasses } from "@/server/queries/classes";
import { getMyChildren } from "@/server/queries/family";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("diary");
  return { title: t("title") };
}

/**
 * The homework of the week — every class of the reader merged, one tick per child.
 *
 * Session 17 made it a week rather than a class; session 33 makes it the place where homework
 * is *done*: it opens on the day being prepared, shows the pages the teacher photographed, and
 * the ring a child taps fills on the spot (ADR-0070).
 */
export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string; enfant?: string; jour?: string; vue?: string }>;
}) {
  const [{ semaine, enfant, jour, vue }, user] = await Promise.all([
    searchParams,
    requireCurrentUser(),
  ]);
  const [t, format, children, teaching] = await Promise.all([
    getTranslations("diary"),
    getFormatter(),
    getMyChildren(),
    getMyTeachingClasses(user.id),
  ]);

  const now = new Date();
  const today = localDateKey(now, SCHOOL_TIME_ZONE);
  let pivot = pivotDay(now);
  let opening = defaultWeek(now);
  // A day asked for brings its week with it (ADR-0083).
  const asked = isDateKey(jour) ? jour : null;
  let monday = asked ? mondayOf(asked) : isDateKey(semaine) ? mondayOf(semaine) : opening;
  let sunday = addDays(monday, 6);

  // A guardian is linked to their children through student_guardians, and each
  // child to a class through enrollments — so one reader can span several
  // classes, and one class can concern two of their children (siblings).
  const allChildren = children.map((row) => row.student);
  const selected = allChildren.find((child) => child.id === enfant)?.id ?? null;
  const shown = selected ? allChildren.filter((child) => child.id === selected) : allChildren;

  const childrenByClass = new Map<string, Array<{ id: string; firstName: string }>>();
  const classIds = new Set<string>();
  for (const child of shown)
    for (const enrolment of child.enrollments) {
      if (!enrolment.class) continue;
      classIds.add(enrolment.class.id);
      childrenByClass.set(enrolment.class.id, [
        ...(childrenByClass.get(enrolment.class.id) ?? []),
        { id: child.id, firstName: child.first_name },
      ]);
    }
  const myClasses = teaching.flatMap((row) =>
    row.class ? [{ id: row.class.id, name: row.class.name }] : [],
  );
  // A filter on one child narrows the diary to that child's classes, teaching included.
  if (!selected) for (const cls of myClasses) classIds.add(cls.id);
  const teamClassIds = new Set(myClasses.map((cls) => cls.id));

  const ids = [...classIds];
  const opensHere = !isDateKey(semaine) && !asked;
  const first = await Promise.all([
    getHomeworkDiary(ids, monday, sunday),
    getClassSizes(ids.filter((id) => teamClassIds.has(id))),
    // Asked alongside, so that the common case pays nothing for it.
    opensHere ? getNextHomeworkDay(ids, pivot) : Promise.resolve(null),
    getPracticeClassIds(user, ids),
  ]);
  let [entries, sizes] = first;
  const nextDay = first[2];
  const practiceClassIds = first[3];
  // During the holidays the day being prepared holds nothing, and neither does the week: the
  // diary opened on two weeks of empty days. It now opens on the first day that holds homework —
  // « Pour lundi · 2 novembre » — when that day is within a month (ADR-0077).
  if (
    opensHere &&
    nextDay &&
    nextDay > sunday &&
    nextDay <= addDays(pivot, 31) &&
    !entries.some((entry) => entry.due_on !== null && entry.due_on >= pivot)
  ) {
    pivot = nextDay;
    opening = mondayOf(nextDay);
    monday = opening;
    sunday = addDays(monday, 6);
    [entries, sizes] = await Promise.all([
      getHomeworkDiary(ids, monday, sunday),
      getClassSizes(ids.filter((id) => teamClassIds.has(id))),
    ]);
  }
  const attachments = await attachmentViews(entries.flatMap((entry) => entry.media));

  const schoolId = user.school?.id ?? null;
  // « Jour » by default, on the day being prepared — or, in another week, its first day with
  // homework; « Semaine » stacks the whole week (ADR-0083).
  // Which view and which day are read from the address in the browser, and changed there without
  // asking the server (ADR-0086); the server only says which day opens when none is named.
  const view = vue === "semaine" ? "week" : "day";
  const inWeek = (day: string) => day >= monday && day <= sunday;
  const defaultDay = inWeek(pivot)
    ? pivot
    : (entries.find((entry) => entry.due_on && inWeek(entry.due_on))?.due_on ?? monday);
  const selectedDay = asked && inWeek(asked) ? asked : defaultDay;
  const stripDays = weekDays(
    monday,
    new Set(entries.flatMap((entry) => (entry.due_on ? [entry.due_on] : []))),
  );
  const href = (
    week: string | null,
    child: string | null,
    options: { day?: string | null; view?: "day" | "week" } = {},
  ) => {
    const params = new URLSearchParams();
    if (options.day) params.set("jour", options.day);
    else if (week && week !== opening) params.set("semaine", week);
    if (child) params.set("enfant", child);
    if ((options.view ?? view) === "week") params.set("vue", "semaine");
    const query = params.toString();
    return query ? `/devoirs?${query}` : "/devoirs";
  };

  return (
    <Column width="text">
      <PageHeader title={t("title")} actions={<NewHomeworkButton classes={myClasses} />} />

      {allChildren.length > 1 && (
        <DiaryChildFilter
          label={t("filterChildren")}
          className="-mt-1"
          options={[
            { id: null, name: t("allChildren") },
            ...allChildren.map((child) => ({ id: child.id, name: child.first_name })),
          ]}
          selected={selected}
          defaultDay={defaultDay}
          days={stripDays}
        />
      )}

      {ids.length === 0 ? (
        <EmptyState icon={BookOpenIcon} title={t("noClass")} description={t("noClassHint")} />
      ) : (
        <>
          <WeekNav
            label={t("week", {
              from: format.dateTime(new Date(`${monday}T12:00:00Z`), {
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              }),
              to: format.dateTime(new Date(`${addDays(monday, 4)}T12:00:00Z`), {
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              }),
            })}
            previous={href(addDays(monday, -7), selected)}
            next={href(addDays(monday, 7), selected)}
            current={monday === opening ? null : href(opening, selected)}
            views={{
              day: href(monday, selected, { day: selectedDay, view: "day" }),
              week: href(monday, selected, { view: "week" }),
            }}
          />
          <HomeworkWeek
            monday={monday}
            pivot={pivot >= monday && pivot <= sunday ? pivot : null}
            today={today}
            defaultDay={defaultDay}
            dayHref={(day) => href(monday, selected, { day, view: "day" })}
            entries={entries}
            attachments={attachments}
            emptyAction={
              myClasses.length > 0 ? (
                <NewHomeworkButton classes={myClasses} variant="outline" />
              ) : undefined
            }
            reader={{
              childrenByClass,
              canTick: schoolId ? canWriteInSchool(user.roles, schoolId) : false,
              teamClassIds,
              classSizes: sizes,
              userId: user.id,
              isAdmin: schoolId ? isSchoolAdmin(user.roles, schoolId) : false,
              showClass: classIds.size > 1,
              practiceClassIds,
            }}
          />
        </>
      )}
    </Column>
  );
}
