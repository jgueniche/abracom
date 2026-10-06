import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { HomeworkComposer } from "@/components/domain/homework/homework-composer";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { requireCurrentUser } from "@/lib/auth/session";
import { levelLabel } from "@/lib/levels";
import { isSchoolStaff } from "@/lib/permissions";
import { getClassSummary, getHomework } from "@/server/queries/class-space";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("homeworkComposer");
  return { title: t("editTitle") };
}

/** Editing a homework: the same form, filled, with its pages — each one can be taken off. */
export default async function EditHomeworkPage({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ retour?: string }>;
}) {
  const [{ postId }, { retour }, user] = await Promise.all([
    params,
    searchParams,
    requireCurrentUser(),
  ]);
  if (!/^[0-9a-f-]{36}$/i.test(postId)) notFound();
  const [t, locale, homework] = await Promise.all([
    getTranslations("homeworkComposer"),
    getLocale(),
    getHomework(postId),
  ]);
  if (!homework) notFound();
  const cls = await getClassSummary(homework.class_id);
  if (!cls) notFound();
  const team =
    isSchoolStaff(user.roles, cls.school_id) ||
    cls.class_teachers.some((row) => row.user_id === user.id);
  if (!team) notFound();

  return (
    <Column width="text">
      <PageHeader
        eyebrow={`${cls.name}${cls.level ? ` · ${levelLabel(cls.level, locale)}` : ""}`}
        title={t("editTitle")}
      />
      <HomeworkComposer
        classId={cls.id}
        schoolId={cls.school_id}
        userId={user.id}
        returnTo={retour === "classe" ? "classe" : "devoirs"}
        existing={homework}
      />
    </Column>
  );
}
