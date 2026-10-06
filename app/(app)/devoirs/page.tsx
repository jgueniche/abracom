import { BookOpenIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { FilterChip, FilterChips } from "@/components/domain/filter-chip";
import { HomeworkWeek } from "@/components/domain/homework/homework-week";
import { WeekNav } from "@/components/domain/homework/week-nav";
import { NewHomeworkButton } from "@/components/domain/new-homework-button";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { requireCurrentUser } from "@/lib/auth/session";
import { addDays, isDateKey, localDateKey, mondayOf } from "@/lib/calendar/dates";
import { defaultWeek, pivotDay, SCHOOL_TIME_ZONE } from "@/lib/homework";
import { canWriteInSchool, isSchoolAdmin } from "@/lib/permissions";
import { attachmentViews } from "@/server/queries/attachments";
import { getClassSizes, getHomeworkDiary } from "@/server/queries/class-space";
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
  searchParams: Promise<{ semaine?: string; enfant?: string }>;
}) {
  const [{ semaine, enfant }, user] = await Promise.all([searchParams, requireCurrentUser()]);
  const [t, format, children, teaching] = await Promise.all([
    getTranslations("diary"),
    getFormatter(),
    getMyChildren(),
    getMyTeachingClasses(user.id),
  ]);

  const now = new Date();
  const today = localDateKey(now, SCHOOL_TIME_ZONE);
  const pivot = pivotDay(now);
  const opening = defaultWeek(now);
  const monday = isDateKey(semaine) ? mondayOf(semaine) : opening;
  const sunday = addDays(monday, 6);

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
  const [entries, sizes] = await Promise.all([
    getHomeworkDiary(ids, monday, sunday),
    getClassSizes(ids.filter((id) => teamClassIds.has(id))),
  ]);
  const attachments = await attachmentViews(entries.flatMap((entry) => entry.media));

  const schoolId = user.school?.id ?? null;
  const href = (week: string | null, child: string | null) => {
    const params = new URLSearchParams();
    if (week && week !== opening) params.set("semaine", week);
    if (child) params.set("enfant", child);
    const query = params.toString();
    return query ? `/devoirs?${query}` : "/devoirs";
  };

  return (
    <Column>
      <PageHeader title={t("title")} actions={<NewHomeworkButton classes={myClasses} />} />

      {allChildren.length > 1 && (
        <FilterChips label={t("filterChildren")} className="-mt-1">
          {[null, ...allChildren.map((child) => child.id)].map((id) => {
            const child = allChildren.find((item) => item.id === id);
            return (
              <FilterChip key={id ?? "all"} href={href(monday, id)} active={selected === id}>
                {child ? child.first_name : t("allChildren")}
              </FilterChip>
            );
          })}
        </FilterChips>
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
          />
          <HomeworkWeek
            monday={monday}
            pivot={pivot >= monday && pivot <= sunday ? pivot : null}
            today={today}
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
            }}
          />
        </>
      )}
    </Column>
  );
}
