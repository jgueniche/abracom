"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/** Header entry point of the global search (a real form: works without JavaScript). */
export function SearchBox({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("search");
  if (compact) {
    return (
      <Link
        href="/recherche"
        aria-label={t("title")}
        className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-accent hover:text-accent-foreground xl:hidden"
      >
        <SearchIcon className="size-5" aria-hidden />
      </Link>
    );
  }
  return (
    <form action="/recherche" role="search" className="hidden items-center xl:flex">
      <label className="relative">
        <span className="sr-only">{t("title")}</span>
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          placeholder={t("placeholder")}
          className="h-10 w-44 rounded-lg border border-input bg-background pr-3 pl-9 text-sm focus:w-64 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        />
      </label>
    </form>
  );
}
