/**
 * Types for the shared parser. `frontmatter.mjs` is plain JavaScript so the CI
 * script and the application can run the very same code; this file is what lets
 * TypeScript see it as more than `any`.
 */
export type HelpRoleName =
  "parent" | "guardian" | "teacher" | "staff" | "school_admin" | "super_admin";

export type HelpTopicName = "signin" | "daily" | "publish" | "manage" | "data";

export type ParsedArticle = {
  slug: string;
  title: string;
  roles: HelpRoleName[];
  routes: string[];
  topic: HelpTopicName;
  keywords: string[];
  since: number;
  reviewed: string;
  body: string;
};

export declare const HELP_ROLES: readonly HelpRoleName[];
export declare const HELP_TOPICS: readonly HelpTopicName[];

export declare class HelpArticleError extends Error {
  readonly file: string;
  constructor(file: string, message: string);
}

export declare function parseFrontMatter(
  source: string,
  file?: string,
): { data: Record<string, string | string[]>; body: string };

export declare function parseArticle(slug: string, source: string, file?: string): ParsedArticle;

export declare function filterBody(body: string, roles: readonly string[]): string;
export declare function plainText(markdown: string): string;
export declare function excerpt(markdown: string, max?: number): string;
export declare function normalize(value: string): string;
