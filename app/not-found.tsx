import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

/**
 * Reached by a wrong address, but also whenever a reader opens something the
 * school did not address to them — an event targeted at another level, a class
 * that is not theirs. Saying which of the two it is would confirm that the
 * resource exists, so the page stays deliberately vague and offers the routes
 * back instead of the single "home" button it used to end on.
 */
const WAYS_BACK = [
  { href: "/annonces", key: "announcements" },
  { href: "/agenda", key: "agenda" },
  { href: "/devoirs", key: "homework" },
] as const;

export default async function NotFound() {
  const t = await getTranslations();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="font-heading text-2xl font-semibold">{t("errors.notFound.title")}</h1>
      <p className="text-muted-foreground">{t("errors.notFound.description")}</p>
      <Button asChild className="min-h-11">
        <Link href="/">{t("common.backHome")}</Link>
      </Button>
      <nav aria-label={t("errors.notFound.title")} className="flex flex-wrap justify-center gap-2">
        {WAYS_BACK.map(({ href, key }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {t(`nav.${key}`)}
          </Link>
        ))}
      </nav>
    </main>
  );
}
