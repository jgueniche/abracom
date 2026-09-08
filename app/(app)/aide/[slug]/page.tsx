import { ArrowLeftIcon, FileDownIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Markdown } from "@/components/domain/markdown";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { isGuideSlug, readGuide } from "@/lib/guides";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("help");
  return { title: isGuideSlug(slug) ? t(`guides.${slug}.title`) : t("title") };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isGuideSlug(slug)) notFound();
  await requireCurrentUser();
  const [t, markdown] = await Promise.all([getTranslations("help"), readGuide(slug)]);
  const body = markdown.replace(/^# .*\n/, "");
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/aide">
          <ArrowLeftIcon aria-hidden />
          {t("title")}
        </Link>
      </Button>
      <PageHeader
        title={t(`guides.${slug}.title`)}
        description={t(`guides.${slug}.hint`)}
        actions={
          <Button asChild variant="outline" className="min-h-11">
            <a href={`/api/guides/${slug}`} target="_blank" rel="noreferrer">
              <FileDownIcon aria-hidden />
              {t("pdf")}
            </a>
          </Button>
        }
      />
      <Card>
        <CardContent>
          <Markdown>{body}</Markdown>
        </CardContent>
      </Card>
    </>
  );
}
