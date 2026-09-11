import { ArrowLeftIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { articlesFor } from "@/lib/help/articles";
import { helpRolesFor } from "@/lib/help/roles";

import { WhatsNewList } from "../_components/whats-new";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.whatsNew");
  return { title: t("title") };
}

/**
 * What the application has gained, newest first, filtered to this reader.
 *
 * Fed by the `since:` of each article — the session that introduced the screen —
 * so it cannot drift from the help itself: an article that is not written does
 * not appear here either, and the coverage check makes sure it gets written.
 */
export default async function WhatsNewPage() {
  const user = await requireCurrentUser();
  const roles = helpRolesFor(user.roles);
  const [t, tHelp, articles] = await Promise.all([
    getTranslations("help.whatsNew"),
    getTranslations("help"),
    articlesFor(roles),
  ]);
  const items = [...articles]
    .sort((a, b) => b.since - a.since || a.title.localeCompare(b.title, "fr"))
    .map((article) => ({
      slug: article.slug,
      title: article.title,
      topic: article.topic,
      excerpt: article.excerpt,
      since: article.since,
    }));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/aide">
          <ArrowLeftIcon aria-hidden />
          {tHelp("back")}
        </Link>
      </Button>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {items.length === 0 ? (
        <EmptyState icon={SparklesIcon} title={t("nothing")} description={t("nothingHint")} />
      ) : (
        <WhatsNewList items={items} />
      )}
    </div>
  );
}
