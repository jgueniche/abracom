import { getFormatter, getTranslations } from "next-intl/server";

import { HomeworkWeek } from "@/components/domain/homework/homework-week";
import { WeekNav } from "@/components/domain/homework/week-nav";
import { NewHomeworkButton } from "@/components/domain/new-homework-button";
import { Column } from "@/components/layouts/column";
import { requireClassAccess } from "@/lib/auth/class-access";
import { addDays, isDateKey, localDateKey, mondayOf } from "@/lib/calendar/dates";
import { defaultWeek, pivotDay, SCHOOL_TIME_ZONE } from "@/lib/homework";
import { canWriteInSchool, isSchoolAdmin } from "@/lib/permissions";
import { attachmentViews } from "@/server/queries/attachments";
import { getHomeworkDiary } from "@/server/queries/class-space";
import { getMyChildren } from "@/server/queries/family";

/**
 * The homework of one class, week by week — the diary's own layout, narrowed to this class.
 * It used to be a grid of cards bucketed « en retard / cette semaine / plus tard », a second
 * way of drawing the same homework that showed neither the pages nor the ticks of the diary.
 */
export default async function HomeworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ semaine?: string }>;
}) {
  const [{ classId }, { semaine }] = await Promise.all([params, searchParams]);
  const [{ user, cls, isTeacher, isStaff }, t, format, children] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("diary"),
    getFormatter(),
    getMyChildren(),
  ]);

  const now = new Date();
  const today = localDateKey(now, SCHOOL_TIME_ZONE);
  const pivot = pivotDay(now);
  const opening = defaultWeek(now);
  const monday = isDateKey(semaine) ? mondayOf(semaine) : opening;
  const sunday = addDays(monday, 6);

  const entries = await getHomeworkDiary([classId], monday, sunday);
  const attachments = await attachmentViews(entries.flatMap((entry) => entry.media));

  // The reader's own children in this class — asked as "whose guardian am I", never read off
  // the class roster, which a teacher may read whole (ADR-0059).
  const mine = children
    .map((row) => row.student)
    .filter((student) => student.enrollments.some((e) => e.class?.id === classId))
    .map((student) => ({ id: student.id, firstName: student.first_name }));
  const team = isTeacher || isStaff;
  const composer = team ? [{ id: classId, name: cls.name }] : [];
  const href = (week: string) =>
    week === opening
      ? `/classes/${classId}/devoirs`
      : `/classes/${classId}/devoirs?semaine=${week}`;

  return (
    <Column>
      {team && (
        <div className="mb-3 flex justify-end">
          <NewHomeworkButton classes={composer} returnTo="classe" />
        </div>
      )}
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
        previous={href(addDays(monday, -7))}
        next={href(addDays(monday, 7))}
        current={monday === opening ? null : href(opening)}
      />
      <HomeworkWeek
        monday={monday}
        pivot={pivot >= monday && pivot <= sunday ? pivot : null}
        today={today}
        entries={entries}
        attachments={attachments}
        emptyAction={
          team ? (
            <NewHomeworkButton classes={composer} variant="outline" returnTo="classe" />
          ) : undefined
        }
        reader={{
          childrenByClass: mine.length > 0 ? new Map([[classId, mine]]) : new Map(),
          canTick: canWriteInSchool(user.roles, cls.school_id),
          teamClassIds: team ? new Set([classId]) : new Set(),
          classSizes: new Map([[classId, cls.students.length]]),
          userId: user.id,
          isAdmin: isSchoolAdmin(user.roles, cls.school_id),
          showClass: false,
        }}
      />
    </Column>
  );
}
