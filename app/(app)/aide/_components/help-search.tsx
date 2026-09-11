"use client";

import { SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDeferredValue, useId, useMemo, useState } from "react";

import { Highlighted } from "@/components/domain/highlight";
import { Button } from "@/components/ui/button";
import { buildIndex, type HelpMatch, searchHelp } from "@/lib/help/search";
import type { HelpSearchEntry } from "@/lib/help/select";

function Result({ match }: { match: HelpMatch }) {
  const tTopics = useTranslations("help.topics");
  return (
    <li>
      <Link
        href={`/aide/${match.entry.slug}`}
        className="flex min-h-11 flex-col rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
      >
        <span className="mb-1 flex flex-wrap items-baseline gap-2">
          <span className="font-medium">{match.entry.title}</span>
          <span className="text-xs text-muted-foreground">{tTopics(match.entry.topic)}</span>
        </span>
        <span className="text-sm text-muted-foreground">
          <Highlighted text={match.snippet} ranges={match.ranges} />
        </span>
      </Link>
    </li>
  );
}

/**
 * Search inside the reader's own articles.
 *
 * Three long pages with no way in was half the problem: "how do I declare an
 * absence" had to be found by eye. The index is built at render from the
 * articles this reader may see, so the search can never surface a paragraph
 * addressed to someone else — and it keeps working offline, which is the one
 * thing in this application that legitimately may (ADR-0045).
 */
export function HelpSearch({
  entries,
  suggestions,
  askHref,
  children,
}: {
  entries: HelpSearchEntry[];
  /** A few ways out of an empty result, in the reader's own articles. */
  suggestions: { slug: string; title: string }[];
  /** Where to ask a human, when this reader has messaging at all. */
  askHref: string | null;
  /** The browsable list, shown whenever the field is empty. */
  children: React.ReactNode;
}) {
  const t = useTranslations("help.search");
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const inputId = useId();

  const index = useMemo(() => buildIndex(entries), [entries]);
  const matches = useMemo(() => searchHelp(index, deferred), [index, deferred]);
  const searching = deferred.trim().length > 1;

  return (
    <>
      <div className="mb-6 flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t("label")}
        </label>
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("placeholder")}
            autoComplete="off"
            className="h-11 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-sm focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
          />
        </div>
        {query !== "" && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={() => setQuery("")}
            aria-label={t("clear")}
          >
            <XIcon aria-hidden />
          </Button>
        )}
      </div>

      {/* Announced to screen readers, which otherwise get a list that silently
          changes under them as the reader types. */}
      <p className="sr-only" role="status" aria-live="polite">
        {searching ? t("results", { count: matches.length, query: deferred.trim() }) : ""}
      </p>

      {!searching ? (
        children
      ) : matches.length > 0 ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground" aria-hidden>
            {t("results", { count: matches.length, query: deferred.trim() })}
          </p>
          <ul className="flex flex-col gap-2">
            {matches.map((match) => (
              <Result key={match.entry.slug} match={match} />
            ))}
          </ul>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed p-6">
          <p className="font-heading text-lg tracking-tight">
            {t("empty", { query: deferred.trim() })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
          <p className="mt-4 mb-2 text-sm font-medium">{t("suggestions")}</p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/aide/${article.slug}`}
                  className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm hover:bg-accent"
                >
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/recherche?q=${encodeURIComponent(deferred.trim())}`}>
                {t("globalSearch")}
              </Link>
            </Button>
            {askHref && (
              <Button asChild variant="ghost" className="min-h-11">
                <Link href={askHref}>{t("ask")}</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
