import { excerpt, filterBody, HELP_TOPICS, plainText } from "@/lib/help/frontmatter.mjs";
import type { HelpRole } from "@/lib/help/roles";

export type HelpTopic = (typeof HELP_TOPICS)[number];

export type HelpArticle = {
  slug: string;
  title: string;
  roles: HelpRole[];
  routes: string[];
  topic: HelpTopic;
  keywords: string[];
  /** The session that introduced the screen — feeds « Quoi de neuf » (ADR-0044). */
  since: number;
  /** Last time a human read this article against the screen (ADR-0046). */
  reviewed: string;
  body: string;
};

/** An article as one reader sees it: sentences for other roles are gone. */
export type ReaderArticle = HelpArticle & { excerpt: string };

/**
 * Pure selection, kept out of the filesystem module so the tests can play the
 * six roles of the brief against the real articles without a Supabase stack.
 */
export function concerns(article: HelpArticle, roles: readonly HelpRole[]): boolean {
  return article.roles.some((role) => roles.includes(role));
}

export function forReader(article: HelpArticle, roles: readonly HelpRole[]): ReaderArticle {
  const body = filterBody(article.body, roles);
  return { ...article, body, excerpt: excerpt(body) };
}

/**
 * What `/aide` shows: ordered by topic then by title, so the shelves read the
 * same way every time; an article that does not concern the reader is absent,
 * not greyed out.
 */
export function selectArticles(
  articles: readonly HelpArticle[],
  roles: readonly HelpRole[],
): ReaderArticle[] {
  return articles
    .filter((article) => concerns(article, roles))
    .map((article) => forReader(article, roles))
    .sort(
      (a, b) =>
        HELP_TOPICS.indexOf(a.topic) - HELP_TOPICS.indexOf(b.topic) ||
        a.title.localeCompare(b.title, "fr"),
    );
}

export function groupByTopic(articles: readonly ReaderArticle[]) {
  return HELP_TOPICS.map((topic) => ({
    topic,
    articles: articles.filter((article) => article.topic === topic),
  })).filter((group) => group.articles.length > 0);
}

/**
 * The compact index the search works on. The normalised haystack is *not*
 * shipped: it would double the payload of `/aide` for text the browser can
 * fold in a single pass (see `lib/help/search.ts`).
 */
export type HelpSearchEntry = {
  slug: string;
  title: string;
  topic: HelpTopic;
  excerpt: string;
  keywords: string[];
  text: string;
};

export function toSearchEntry(article: ReaderArticle): HelpSearchEntry {
  return {
    slug: article.slug,
    title: article.title,
    topic: article.topic,
    excerpt: article.excerpt,
    keywords: article.keywords,
    text: plainText(article.body).replace(/\n+/g, " "),
  };
}
