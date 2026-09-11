import { BookOpenIcon, FileDownIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { articlesFor, groupByTopic, toSearchEntry } from "@/lib/help/articles";
import { helpRolesFor } from "@/lib/help/roles";
import { canUseMessaging } from "@/lib/permissions";

import { HelpSearch } from "./_components/help-search";
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
  // A dead end is not an answer: an empty search offers the first article of
  // each shelf, the global search, and — for those who have it — a human.
  const suggestions = groups.map((group) => {
    const first = group.articles[0]!;
    return { slug: first.slug, title: first.title };
  });
  const askHref =
    user.school && canUseMessaging(user.roles, user.school.id) ? "/messages/nouveau" : null;

  return (
    <Column>
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

      <HelpSearch
        entries={articles.map((article) => toSearchEntry(article))}
        suggestions={suggestions}
        askHref={askHref}
      >
        {groups.length === 0 ? (
          <EmptyState icon={BookOpenIcon} title={t("empty")} description={t("emptyHint")} />
        ) : (
          <div className="flex flex-col gap-10">
            {groups.map((group) => (
              <section key={group.topic} aria-labelledby={`topic-${group.topic}`}>
                <SectionHeader
                  id={`topic-${group.topic}`}
                  label={tTopics(group.topic)}
                  count={group.articles.length}
                  hint={tTopics(`${group.topic}Hint`)}
                />
                <ul className="grid gap-2 sm:grid-cols-2">
                  {group.articles.map((article) => (
                    <li key={article.slug}>
                      <Link
                        href={`/aide/${article.slug}`}
                        className="flex h-full min-h-11 flex-col rounded-xl border border-border bg-card p-3 transition-colors hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_16%)] hover:bg-muted/50"
                      >
                        <span className="text-sm font-medium">{article.title}</span>
                        <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
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
      </HelpSearch>

      <p className="mt-8 text-sm text-muted-foreground">{t("languageNote")}</p>
    </Column>
  );
}
