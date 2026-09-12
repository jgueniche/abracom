import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { Button } from "@/components/ui/button";

/**
 * The same message as the public 404, but kept inside the application.
 *
 * A reader who opened a class that is not theirs — or simply a stale link —
 * used to be dropped on a bare page with no header, no tabs and no way back
 * except one button: the application disappeared around them at the exact
 * moment they had made a wrong turn. The shell is the way back.
 *
 * It writes its own title block rather than borrowing `PageHeader`, whose help
 * mark would offer the article of the screen the reader precisely failed to
 * reach.
 */
const WAYS_BACK = [
  { href: "/annonces", key: "announcements" },
  { href: "/agenda", key: "agenda" },
  { href: "/devoirs", key: "homework" },
] as const;

export default async function AppNotFound() {
  const t = await getTranslations();

  return (
    <Column width="text">
      <p className="eyebrow mb-1.5">404</p>
      <h1>{t("errors.notFound.title")}</h1>
      <p className="mt-1.5 text-[0.8125rem] text-pretty text-muted-foreground">
        {t("errors.notFound.description")}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button asChild className="min-h-11">
          <Link href="/accueil">{t("common.backHome")}</Link>
        </Button>
        <nav aria-label={t("errors.notFound.title")} className="flex flex-wrap gap-2">
          {WAYS_BACK.map(({ href, key }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-11 items-center rounded-md border border-border bg-card px-3 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(`nav.${key}`)}
            </Link>
          ))}
        </nav>
      </div>
    </Column>
  );
}
