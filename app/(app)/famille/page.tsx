import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StudentCard } from "@/components/domain/student-card";
import { PageHeader } from "@/components/layouts/page-header";
import { requireCurrentUser } from "@/lib/auth/session";
import { getMyChildren } from "@/server/queries/family";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("family");
  return { title: t("title") };
}

export default async function FamilyPage() {
  const user = await requireCurrentUser();
  const t = await getTranslations("family");
  const children = await getMyChildren();
  const readOnly =
    user.roles.some((r) => r.role === "guardian") && !user.roles.some((r) => r.role === "parent");

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {readOnly && <p className="mb-4 text-sm text-muted-foreground">{t("readOnly")}</p>}
      {children.length === 0 ? (
        <p className="text-muted-foreground">{t("noChildren")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child) => (
            <StudentCard key={child.student.id} child={child} />
          ))}
        </div>
      )}
    </>
  );
}
