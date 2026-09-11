import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  excerpt,
  filterBody,
  HELP_TOPICS,
  normalize,
  parseArticle,
  plainText,
} from "@/lib/help/frontmatter.mjs";
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

export const HELP_DIR = path.join(process.cwd(), "content", "help");

/** Articles are versioned files (ADR-0043): the repository is the source of truth. */
export async function readAllArticles(): Promise<HelpArticle[]> {
  const names = (await readdir(HELP_DIR)).filter((name) => name.endsWith(".md")).sort();
  const articles = await Promise.all(
    names.map(async (name) => {
      const slug = name.slice(0, -3);
      const source = await readFile(path.join(HELP_DIR, name), "utf8");
      return parseArticle(slug, source, name) as HelpArticle;
    }),
  );
  return articles;
}

/**
 * Read once per process in production, on every call in development, so that
 * editing an article shows up on reload without restarting the dev server.
 */
let cached: Promise<HelpArticle[]> | null = null;
export function getArticles(): Promise<HelpArticle[]> {
  if (process.env.NODE_ENV !== "production") return readAllArticles();
  cached ??= readAllArticles();
  return cached;
}

/** An article as one reader sees it: sentences for other roles are gone. */
export type ReaderArticle = Omit<HelpArticle, "body"> & { body: string; excerpt: string };

function forReader(article: HelpArticle, roles: readonly HelpRole[]): ReaderArticle {
  const body = filterBody(article.body, roles);
  return { ...article, body, excerpt: excerpt(body) };
}

function concerns(article: HelpArticle, roles: readonly HelpRole[]): boolean {
  return article.roles.some((role) => roles.includes(role));
}

/**
 * What `/aide` shows. Ordered by topic then by title, so the shelves read the
 * same way every time; an article that does not concern the reader is absent,
 * not greyed out.
 */
export async function articlesFor(roles: readonly HelpRole[]): Promise<ReaderArticle[]> {
  const articles = await getArticles();
  return articles
    .filter((article) => concerns(article, roles))
    .map((article) => forReader(article, roles))
    .sort(
      (a, b) =>
        HELP_TOPICS.indexOf(a.topic) - HELP_TOPICS.indexOf(b.topic) ||
        a.title.localeCompare(b.title, "fr"),
    );
}

export async function articleFor(
  slug: string,
  roles: readonly HelpRole[],
): Promise<ReaderArticle | null> {
  const articles = await getArticles();
  const article = articles.find((item) => item.slug === slug);
  if (!article || !concerns(article, roles)) return null;
  return forReader(article, roles);
}

export function groupByTopic(articles: readonly ReaderArticle[]) {
  return HELP_TOPICS.map((topic) => ({
    topic,
    articles: articles.filter((article) => article.topic === topic),
  })).filter((group) => group.articles.length > 0);
}

/** The compact index the search box works on — title, keywords and body. */
export type HelpSearchEntry = {
  slug: string;
  title: string;
  topic: HelpTopic;
  excerpt: string;
  /** Pre-normalised (lower case, no diacritics) so the browser does it once. */
  haystack: string;
  text: string;
};

export function toSearchEntry(article: ReaderArticle): HelpSearchEntry {
  const text = plainText(article.body).replace(/\n+/g, " ");
  return {
    slug: article.slug,
    title: article.title,
    topic: article.topic,
    excerpt: article.excerpt,
    haystack: normalize(`${article.title} ${article.keywords.join(" ")} ${text}`),
    text,
  };
}
