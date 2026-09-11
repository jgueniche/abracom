import { BookOpenIcon, FileDownIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { articlesFor, groupByTopic } from "@/lib/help/articles";
import { helpRolesFor } from "@/lib/help/roles";

import { WhatsNewBadge } from "./_components/whats-new";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help");
  return { title: t("title") };
}

/**
 * The help of a single reader.
 *
 * It used to be three cards — parents, teachers, direction — which sent the
 * secretariat to the direction guide (it has neither assessments, nor CSV
 * import, nor audit log) and a read-only guardian to the parents' guide, which
 * describes screens they do not have. What is not for this reader is not greyed
 * out here: it is absent.
 */
export default async function HelpPage() {
  const user = await requireCurrentUser();
  const roles = helpRolesFor(user.roles);
  const [t, tTopics, articles] = await Promise.all([
    getTranslations("help"),
    getTranslations("help.topics"),
    articlesFor(roles),
  ]);
  const groups = groupByTopic(articles);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/aide/quoi-de-neuf">
                <SparklesIcon aria-hidden />
                {t("whatsNew.title")}
                <WhatsNewBadge sinceList={articles.map((article) => article.since)} />
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <a href="/api/aide/guide" target="_blank" rel="noreferrer">
                <FileDownIcon aria-hidden />
                {t("pdf")}
              </a>
            </Button>
          </>
        }
      />

      {groups.length === 0 ? (
        <EmptyState icon={BookOpenIcon} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.topic} aria-labelledby={`topic-${group.topic}`}>
              <h2 id={`topic-${group.topic}`} className="mb-1 text-lg">
                {tTopics(group.topic)}
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">{tTopics(`${group.topic}Hint`)}</p>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {group.articles.map((article) => (
                  <li key={article.slug}>
                    <Link
                      href={`/aide/${article.slug}`}
                      className="flex h-full min-h-11 flex-col rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
                    >
                      <span className="font-medium">{article.title}</span>
                      <span className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {article.excerpt}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-8 text-sm text-muted-foreground">{t("languageNote")}</p>
    </>
  );
}
