import { WifiOffIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { appName } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offline");
  return { title: t("title") };
}

/** Cached by the service worker at install time and served when the network is unavailable. */
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOffIcon className="size-12 text-muted-foreground" aria-hidden />
      <p className="font-heading text-lg font-semibold">{appName}</p>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <a
        href="/accueil"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        {t("retry")}
      </a>
    </main>
  );
}
