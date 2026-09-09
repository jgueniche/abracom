import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { globalSearch, hrefForResult } from "@/server/queries/search";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("search");
  return { title: t("title") };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireCurrentUser();
  const { q = "" } = await searchParams;
  const [t, format, results] = await Promise.all([
    getTranslations("search"),
    getFormatter(),
    globalSearch(q),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("hint")} />
      <form action="/recherche" role="search" className="mb-6 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">{t("title")}</span>
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus={q === ""}
            placeholder={t("placeholder")}
            className="h-11 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-sm focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
          />
        </label>
        <Button type="submit" className="min-h-11">
          {t("submit")}
        </Button>
      </form>
      {q.trim().length >= 2 && (
        <p className="mb-3 text-sm text-muted-foreground" role="status">
          {t("results", { count: results.length, query: q.trim() })}
        </p>
      )}
      {q.trim().length >= 2 && results.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((row) => (
            <li key={`${row.kind}-${row.id}`}>
              <Link
                href={hrefForResult(row)}
                className="block rounded-xl border p-3 hover:bg-accent/60"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{t(`kinds.${row.kind}`)}</Badge>
                  {row.happened_at && (
                    <span className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(row.happened_at), { dateStyle: "medium" })}
                    </span>
                  )}
                </div>
                <p className="font-medium">{row.title}</p>
                {row.snippet && (
                  <p
                    className="line-clamp-2 text-sm text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground"
                    dangerouslySetInnerHTML={{ __html: sanitizeHeadline(row.snippet) }}
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** `ts_headline` only emits <b>…</b>: escape everything else before trusting the markers. */
function sanitizeHeadline(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;b&gt;/g, "<b>")
    .replace(/&lt;\/b&gt;/g, "</b>");
}
