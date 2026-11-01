import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { Link } from "@/components/ui/link";
import { getTranslations } from "next-intl/server";

import { PasswordForm } from "@/components/forms/password-form";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMfaStatus } from "@/lib/auth/mfa";
import { isTestOnlyAccount } from "@/lib/auth/school-choice";
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
    getMfaStatus(user),
  ]);
  const isAdmin = user.school !== null && isSchoolAdmin(user.roles, user.school.id);
  // A shared account of the test school (ADR-0079): neither its password nor a second
  // factor is one visitor's to set, so the page says why instead of offering either.
  const shared = isTestOnlyAccount(user.memberships);
  return (
    <Column width="text">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/profil">
          <ArrowLeftIcon aria-hidden />
          {tp("title")}
        </Link>
      </Button>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {requis === "1" && !status.enrolled && (
        <p className="mb-6 border-l-2 border-primary pl-3 text-sm" role="alert">
          {t("requiredNotice")}
        </p>
      )}
      {shared ? (
        <p className="max-w-xl border-l-2 border-primary pl-3 text-sm text-pretty">
          {t("sharedTestAccount")}
        </p>
      ) : (
        <>
          <section className="mb-10">
            <SectionHeader label={t("passwordSection")} />
            <PasswordForm mode="change" email={user.email} />
          </section>
          <section>
            <SectionHeader label={t("mfaSection")} />
            <Card className="max-w-xl">
              <CardContent>
                <TotpSetup enrolled={status.enrolled} isAdmin={isAdmin} />
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </Column>
  );
}
