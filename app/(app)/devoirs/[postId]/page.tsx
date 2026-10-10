import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { DoneToggle } from "@/components/domain/homework/done-toggle";
import { HomeworkPages } from "@/components/domain/homework/homework-pages";
import { HomeworkProgress } from "@/components/domain/homework/progress";
import { Markdown } from "@/components/domain/markdown";
import { PostActions } from "@/components/domain/post-actions";
import { PrintButton } from "@/components/domain/print-button";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Link } from "@/components/ui/link";
import { requireCurrentUser } from "@/lib/auth/session";
import { mondayOf } from "@/lib/calendar/dates";
import { doneKey, subjectTone } from "@/lib/homework";
import { canWriteInSchool, isSchoolAdmin, isSchoolStaff } from "@/lib/permissions";
import { attachmentViews } from "@/server/queries/attachments";
import { getClassSizes, getHomework, isClassTeacher } from "@/server/queries/class-space";
import { getMyChildren } from "@/server/queries/family";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const homework = /^[0-9a-f-]{36}$/i.test(postId) ? await getHomework(postId) : null;
  const t = await getTranslations("diary");
  return { title: homework?.title ?? t("title") };
}

/**
 * One homework on its own page — what a notification opens, what a parent prints.
 *
 * The pages are shown at the width of the column, readable on a phone without opening anything,
 * and « Imprimer » prints them one per sheet, under the title and the date: the page of the
 * revision book a child left at school comes out of the family printer as a page.
 */
export default async function HomeworkPage({ params }: { params: Promise<{ postId: string }> }) {
  const [{ postId }, user] = await Promise.all([params, requireCurrentUser()]);
  if (!/^[0-9a-f-]{36}$/i.test(postId)) notFound();
  const [t, format, homework, children] = await Promise.all([
    getTranslations("diary"),
    getFormatter(),
    getHomework(postId),
    getMyChildren(),
  ]);
  if (!homework || !homework.due_on) notFound();

  const schoolId = homework.class?.school_id ?? homework.school_id;
  const [attachments, teaches, sizes] = await Promise.all([
    attachmentViews(homework.media),
    isClassTeacher(homework.class_id, user.id),
    getClassSizes([homework.class_id]),
  ]);
  const team = teaches || isSchoolStaff(user.roles, schoolId);
  const canEdit = team && (homework.author_id === user.id || isSchoolAdmin(user.roles, schoolId));
  const canTick = canWriteInSchool(user.roles, schoolId);
  const mine = children
    .map((row) => row.student)
    .filter((student) => student.enrollments.some((e) => e.class?.id === homework.class_id))
    .map((student) => ({ id: student.id, firstName: student.first_name }));
  const tone = subjectTone(homework.subject);
  const size = sizes.get(homework.class_id) ?? 0;
  const views = homework.media.flatMap((media) => {
    const view = attachments.get(media.id);
    return view ? [view] : [];
  });
  const due = format.dateTime(new Date(`${homework.due_on}T12:00:00Z`), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return (
    <Column width="text">
      <Link
        href={`/devoirs?semaine=${mondayOf(homework.due_on)}#devoir-${homework.id}`}
        className="no-print mb-3 -ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-foreground/75 hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        {t("backToWeek")}
      </Link>
      <PageHeader
        eyebrow={[homework.subject, homework.class?.name].filter(Boolean).join(" · ")}
        title={homework.title}
        actions={
          canEdit ? (
            <PostActions
              postId={homework.id}
              editHref={`/devoirs/${homework.id}/modifier`}
              afterDelete={`/devoirs?semaine=${mondayOf(homework.due_on)}`}
            />
          ) : undefined
        }
      />
      <p className="-mt-4 mb-5 text-[0.9375rem] font-medium text-foreground first-letter:uppercase">
        {t("dueOn", { date: due })}
        {homework.published_at === null && (
          <span className="ml-2 text-sm font-normal text-brick">· {t("draft")}</span>
        )}
      </p>

      {/* What there is to do with it: tick it, print it. */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {mine.length > 0 ? (
          <HomeworkProgress
            doneKeys={homework.completions
              .filter((completion) => mine.some((child) => child.id === completion.student_id))
              .map((completion) => doneKey(homework.id, completion.student_id))}
          >
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {mine.map((child) => (
                <DoneToggle
                  key={child.id}
                  postId={homework.id}
                  studentId={child.id}
                  title={homework.title}
                  tone={tone}
                  childName={child.firstName}
                  showName={mine.length > 1}
                  readOnly={!canTick}
                  withText={canTick}
                />
              ))}
            </div>
          </HomeworkProgress>
        ) : (
          <span />
        )}
        {(views.length > 0 || homework.body_md) && <PrintButton />}
      </div>

      {homework.body_md && (
        <div dir="auto" className="mb-6">
          <Markdown size="compact">{homework.body_md}</Markdown>
        </div>
      )}

      <HomeworkPages items={views} title={homework.title} />

      <footer className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule pt-3 text-xs text-muted-foreground">
        {homework.author && (
          <span>
            {t("givenBy", {
              name: `${homework.author.first_name} ${homework.author.last_name}`,
              date: format.dateTime(new Date(homework.published_at ?? homework.created_at), {
                day: "numeric",
                month: "long",
              }),
            })}
          </span>
        )}
        {team && homework.published_at && size > 0 && (
          <span className="tabular-nums">
            {t("doneByTotal", { count: homework.completions.length, total: size })}
          </span>
        )}
      </footer>
    </Column>
  );
}
