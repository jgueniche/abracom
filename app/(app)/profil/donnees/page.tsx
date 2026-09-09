import { ArrowLeftIcon, FileDownIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";

import { DeleteAccountForm } from "./delete-account-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dataRights");
  return { title: t("title") };
}

export default async function DataRightsPage() {
  await requireCurrentUser();
  const [t, tp] = await Promise.all([getTranslations("dataRights"), getTranslations("profile")]);
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/profil">
          <ArrowLeftIcon aria-hidden />
          {tp("title")}
        </Link>
      </Button>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("export")}</CardTitle>
            <CardDescription>{t("exportHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="min-h-11">
              <a href="/api/export/donnees">
                <FileDownIcon aria-hidden />
                {t("exportButton")}
              </a>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>{t("deleteTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DeleteAccountForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
