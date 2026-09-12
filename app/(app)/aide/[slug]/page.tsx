import { ArrowLeftIcon, ArrowUpRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { Markdown } from "@/components/domain/markdown";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { articleFor } from "@/lib/help/articles";
import { HELP_ROLE_LIST, helpRolesFor } from "@/lib/help/roles";

async function load(slug: string) {
  const user = await requireCurrentUser();
  const roles = helpRolesFor(user.roles);
  const article = await articleFor(slug, roles);
  if (!article) notFound();
  return { article, roles };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { article } = await load(slug);
  return { title: article.title };
}

/**
 * One article, as this reader is entitled to read it: the `:::roles` paragraphs
 * meant for other roles are already gone from `article.body`, so a read-only
 * guardian is never told to "open the messaging".
 */
export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [{ article }, t, tTopics, tRoles, format] = await Promise.all([
    load(slug),
    getTranslations("help"),
    getTranslations("help.topics"),
    getTranslations("roles"),
    getFormatter(),
  ]);
  // Concrete screens only: a route with a `[param]` cannot be opened blind.
  const links = article.routes.filter((route) => !route.includes("["));

  return (
    <Column width="text">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/aide">
          <ArrowLeftIcon aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader eyebrow={tTopics(article.topic)} title={article.title} />
      <Card>
        <CardContent>
          <Markdown>{article.body}</Markdown>
        </CardContent>
      </Card>

      {links.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {links.map((route) => (
            <Button key={route} asChild variant="outline" className="min-h-11">
              <Link href={route}>
                {t("openScreen")}
                <ArrowUpRightIcon aria-hidden />
              </Link>
            </Button>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">{t("audience")}</Badge>
        <span>
          {article.roles.length === HELP_ROLE_LIST.length
            ? t("everyone")
            : article.roles.map((role) => tRoles(role)).join(" · ")}
        </span>
        <span aria-hidden>·</span>
        {/* Shown on purpose: the freshness contract is checked by the build
            (ADR-0046), and a reader who sees a stale date can say so. */}
        <span>
          {t("reviewedOn", {
            date: format.dateTime(new Date(`${article.reviewed}T12:00:00Z`), {
              dateStyle: "long",
            }),
          })}
        </span>
      </div>
    </Column>
  );
}
