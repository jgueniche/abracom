import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { canWriteInSchool } from "@/lib/permissions";
import { getGroupTargetClasses } from "@/server/queries/messaging";

import { GroupForm } from "./group-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("messaging.group");
  return { title: t("title") };
}

export default async function NewGroupPage() {
  const user = await requireCurrentUser();
  if (!user.school || !canWriteInSchool(user.roles, user.school.id)) redirect("/messages");

  const [t, classes] = await Promise.all([
    getTranslations("messaging.group"),
    getGroupTargetClasses(),
  ]);

  return (
    <Column width="text">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 min-h-11">
        <Link href="/messages">
          <ArrowLeftIcon aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {classes.length === 0 ? (
        <EmptyState title={t("noClass")} description={t("noClassHint")} />
      ) : (
        <GroupForm
          classes={classes.map((cls) => ({
            id: cls.id,
            name: cls.name,
            level: cls.level_code,
            guardians: Number(cls.guardians ?? 0),
          }))}
        />
      )}
    </Column>
  );
}
