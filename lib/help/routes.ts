/**
 * Matching a concrete path against the routes an article declares.
 *
 * Pure and client-safe on purpose: the "?" in the page header runs in the
 * browser, where `usePathname()` gives `/classes/42/devoirs` and the article
 * declares `/classes/[classId]/devoirs`.
 */

/** `/classes/[classId]/devoirs` matches `/classes/42/devoirs`, nothing longer. */
export function matchesRoute(route: string, pathname: string): boolean {
  const expected = route.split("/");
  const actual = pathname.replace(/\/+$/, "").split("/");
  if (expected.length !== actual.length) return false;
  return expected.every((segment, index) =>
    segment.startsWith("[") && segment.endsWith("]")
      ? (actual[index] ?? "") !== ""
      : segment === actual[index],
  );
}

/**
 * The article that documents this screen. The most specific route wins, so
 * `/classes` does not answer for `/classes/[classId]/absences` when a better
 * article exists; a literal segment beats a `[param]` at equal depth.
 */
export function articleForRoute<T extends { routes: readonly string[] }>(
  articles: readonly T[],
  pathname: string,
): T | null {
  let best: { article: T; score: number } | null = null;
  for (const article of articles) {
    for (const route of article.routes) {
      if (!matchesRoute(route, pathname)) continue;
      const segments = route.split("/");
      const score = segments.length * 10 - segments.filter((s) => s.startsWith("[")).length;
      if (!best || score > best.score) best = { article, score };
    }
  }
  return best?.article ?? null;
}
