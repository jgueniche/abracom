import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMfaStatus } from "@/lib/auth/mfa";
import { requireCurrentUser } from "@/lib/auth/session";
import { isSchoolAdmin } from "@/lib/permissions";

import { TotpSetup } from "./totp-setup";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("security");
  return { title: t("title") };
}

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ requis?: string }>;
}) {
  const user = await requireCurrentUser();
  const { requis } = await searchParams;
  const [t, tp, status] = await Promise.all([
    getTranslations("security"),
    getTranslations("profile"),
    getMfaStatus(),
  ]);
  const isAdmin = user.school !== null && isSchoolAdmin(user.roles, user.school.id);
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/profil">
          <ArrowLeftIcon aria-hidden />
          {tp("title")}
        </Link>
      </Button>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {requis === "1" && !status.enrolled && (
        <p className="mb-4 rounded-xl border border-primary bg-primary/5 p-3 text-sm" role="alert">
          {t("requiredNotice")}
        </p>
      )}
      <Card className="max-w-xl">
        <CardContent>
          <TotpSetup enrolled={status.enrolled} isAdmin={isAdmin} />
        </CardContent>
      </Card>
    </>
  );
}
