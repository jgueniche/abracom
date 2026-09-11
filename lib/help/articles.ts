import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parseArticle } from "@/lib/help/frontmatter.mjs";
import type { HelpRole } from "@/lib/help/roles";
import {
  concerns,
  forReader,
  type HelpArticle,
  type ReaderArticle,
  selectArticles,
} from "@/lib/help/select";

export type { HelpArticle, HelpTopic, ReaderArticle } from "@/lib/help/select";
export { groupByTopic, toSearchEntry } from "@/lib/help/select";

export const HELP_DIR = path.join(process.cwd(), "content", "help");

/** Articles are versioned files (ADR-0043): the repository is the source of truth. */
export async function readAllArticles(): Promise<HelpArticle[]> {
  const names = (await readdir(HELP_DIR)).filter((name) => name.endsWith(".md")).sort();
  return Promise.all(
    names.map(async (name) => {
      const source = await readFile(path.join(HELP_DIR, name), "utf8");
      return parseArticle(name.slice(0, -3), source, name);
    }),
  );
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

export async function articlesFor(roles: readonly HelpRole[]): Promise<ReaderArticle[]> {
  return selectArticles(await getArticles(), roles);
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

/**
 * The lookup table the page header carries (slug, title, routes) — no bodies:
 * it rides on every screen of the application, so it stays a few kilobytes.
 */
export async function helpIndexFor(
  roles: readonly HelpRole[],
): Promise<{ slug: string; title: string; routes: string[] }[]> {
  const articles = await getArticles();
  return articles
    .filter((article) => concerns(article, roles))
    .map((article) => ({ slug: article.slug, title: article.title, routes: article.routes }));
}
