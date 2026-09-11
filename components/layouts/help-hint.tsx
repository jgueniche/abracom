"use client";

import { CircleQuestionMarkIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useContext, useMemo } from "react";

import { articleForRoute } from "@/lib/help/routes";

export type HelpIndexEntry = { slug: string; title: string; routes: string[] };

const HelpIndex = createContext<readonly HelpIndexEntry[] | null>(null);

/**
 * The reader's articles, reduced to what a lookup needs (slug, title, routes):
 * a few kilobytes carried by the shell so that any page can answer "where is
 * the help for this screen?" without a round trip.
 */
export function HelpIndexProvider({
  articles,
  children,
}: {
  articles: HelpIndexEntry[];
  children: ReactNode;
}) {
  return <HelpIndex value={articles}>{children}</HelpIndex>;
}

/**
 * The "?" beside a page title.
 *
 * Half of the help problem was never the writing: someone stuck on `/devoirs`
 * had to guess that `/aide` existed, open it, pick a guide and scan it by eye.
 * It is also what keeps the coverage check honest — a screen with no article
 * shows it immediately, here, rather than in a CI log nobody reads.
 *
 * Renders nothing outside the signed-in shell, and nothing when no article
 * addressed to this reader documents the current path.
 */
export function HelpHint() {
  const t = useTranslations("help.contextual");
  const pathname = usePathname();
  const articles = useContext(HelpIndex);
  const article = useMemo(
    () => (articles ? articleForRoute(articles, pathname) : null),
    [articles, pathname],
  );
  if (!article) return null;

  return (
    <Link
      href={`/aide/${article.slug}`}
      aria-label={`${t("label")} — ${article.title}`}
      title={article.title}
      className="-my-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground md:size-8"
    >
      <CircleQuestionMarkIcon className="size-4" aria-hidden />
    </Link>
  );
}
