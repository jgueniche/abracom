import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

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
    </main>
  );
}
