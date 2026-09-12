import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { canWriteInSchool } from "@/lib/permissions";

import { ClassifiedForm } from "../../_components/classified-form";

export default async function NewClassifiedPage() {
  const user = await requireCurrentUser();
  const t = await getTranslations("community.classifieds");
  if (!user.school || !canWriteInSchool(user.roles, user.school.id))
    redirect("/communaute/annonces");
  return (
    <Column width="text">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/communaute/annonces">
          <ArrowLeftIcon aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader title={t("new")} />
      <ClassifiedForm />
    </Column>
  );
}
