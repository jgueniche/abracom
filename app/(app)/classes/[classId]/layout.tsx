import { MessageCircleIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireClassAccess } from "@/lib/auth/class-access";
import { canSeeAssessments, canUseMessaging } from "@/lib/permissions";
import { levelLabel } from "@/lib/levels";
import { openClassGroup } from "@/server/actions/messaging";

import { ClassTabs } from "./_components/class-tabs";

export default async function ClassLayout({
  params,
  children,
}: {
  params: Promise<{ classId: string }>;
  children: ReactNode;
}) {
  const { classId } = await params;
  const [{ user, cls, isTeacher, isStaff }, t, tFamily] = await Promise.all([
    requireClassAccess(classId),
    getTranslations("classSpace"),
    getTranslations("family"),
  ]);
  const [tMessaging, locale] = await Promise.all([getTranslations("messaging"), getLocale()]);
  const canMessage = canUseMessaging(user.roles, cls.school_id);
  const showAssessments = canSeeAssessments(user.roles, cls.school_id);
  const team = cls.class_teachers
    .filter((ct) => ct.profile)
    .map(
      (ct) =>
        `${ct.profile!.first_name} ${ct.profile!.last_name} (${tFamily(`teacherRole.${ct.role}`)}${ct.subject ? ` · ${ct.subject}` : ""})`,
    )
    .join(" · ");

  return (
    <>
      <PageHeader
        title={cls.name}
        description={`${levelLabel(cls.level, locale)}${cls.room ? ` · ${cls.room}` : ""}${team ? ` · ${team}` : ""}`}
        actions={
          <>
            {/* a read-only guardian has no messaging: the button led to an empty list */}
            {canMessage &&
              (isTeacher || isStaff ? (
                <form action={openClassGroup}>
                  <input type="hidden" name="classId" value={classId} />
                  <Button type="submit" variant="outline" className="min-h-11">
                    <MessageCircleIcon aria-hidden />
                    {tMessaging("classDiscussion")}
                  </Button>
                </form>
              ) : (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href="/messages">
                    <MessageCircleIcon aria-hidden />
                    {tMessaging("classDiscussion")}
                  </Link>
                </Button>
              ))}
            {(isTeacher || isStaff) && (
              <Button asChild className="min-h-11">
                <Link href={`/classes/${classId}/publier`}>
                  <PlusIcon aria-hidden />
                  {t("post.new")}
                </Link>
              </Button>
            )}
          </>
        }
      />
      <ClassTabs classId={classId} showAssessments={showAssessments} />
      {children}
    </>
  );
}
