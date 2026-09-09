import { BookOpenIcon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { GUIDE_SLUGS } from "@/lib/guides";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help");
  return { title: t("title") };
}

export default async function HelpPage() {
  await requireCurrentUser();
  const t = await getTranslations("help");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-4 md:grid-cols-3">
        {GUIDE_SLUGS.map((slug) => (
          <Link key={slug} href={`/aide/${slug}`} className="group">
            <Card className="h-full transition-colors group-hover:bg-accent/40">
              <CardHeader className="flex flex-row items-start gap-3">
                <BookOpenIcon className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <CardTitle>{t(`guides.${slug}.title`)}</CardTitle>
                  <CardDescription>{t(`guides.${slug}.hint`)}</CardDescription>
                </div>
                <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">{t("languageNote")}</p>
    </>
  );
}
