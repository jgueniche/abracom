import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { HomeworkComposer } from "@/components/domain/homework/homework-composer";
import { Row, RowList } from "@/components/domain/row-list";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { requireCurrentUser } from "@/lib/auth/session";
import { levelLabel } from "@/lib/levels";
import { isSchoolStaff } from "@/lib/permissions";
import { getClassSummary } from "@/server/queries/class-space";
import { getMyTeachingClasses } from "@/server/queries/classes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("homeworkComposer");
  return { title: t("newTitle") };
}

/**
 * Setting a homework, in the homework space rather than inside a class.
 *
 * The composer used to live under the class space, so a teacher opened it below the class's
 * name, its team, two buttons and two rows of eight tabs — half a phone screen of navigation
 * before « Pour quand ? ». It now has the screen to itself; the class is named in the dateline,
 * and asked for first only when the teacher has several.
 */
export default async function NewHomeworkPage({
  searchParams,
}: {
  searchParams: Promise<{ classe?: string; retour?: string }>;
}) {
  const [{ classe, retour }, user] = await Promise.all([searchParams, requireCurrentUser()]);
  const [t, locale, teaching] = await Promise.all([
    getTranslations("homeworkComposer"),
    getLocale(),
    getMyTeachingClasses(user.id),
  ]);
  const mine = teaching.flatMap((row) => (row.class ? [row.class] : []));

  let classId = classe ?? null;
  if (!classId) {
    if (mine.length === 1) classId = mine[0]!.id;
    else if (mine.length === 0) redirect("/devoirs");
    else
      return (
        <Column width="text">
          <PageHeader title={t("newTitle")} description={t("chooseClass")} />
          <RowList>
            {mine.map((cls) => (
              <Row
                key={cls.id}
                href={`/devoirs/nouveau?classe=${cls.id}`}
                title={cls.name}
                detail={cls.level ? levelLabel(cls.level, locale) : undefined}
              />
            ))}
          </RowList>
        </Column>
      );
  }

  const cls = await getClassSummary(classId);
  if (!cls) notFound();
  const team =
    isSchoolStaff(user.roles, cls.school_id) ||
    cls.class_teachers.some((row) => row.user_id === user.id);
  if (!team) notFound();

  return (
    <Column width="text">
      <PageHeader
        eyebrow={`${cls.name}${cls.level ? ` · ${levelLabel(cls.level, locale)}` : ""}`}
        title={t("newTitle")}
      />
      <HomeworkComposer
        classId={cls.id}
        schoolId={cls.school_id}
        userId={user.id}
        returnTo={retour === "classe" ? "classe" : "devoirs"}
      />
    </Column>
  );
}
