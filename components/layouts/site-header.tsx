import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/layouts/locale-switcher";
import { ThemeToggle } from "@/components/layouts/theme-toggle";
import { appName } from "@/lib/env";

export async function SiteHeader() {
  const t = await getTranslations("common");
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
          {appName}
        </Link>
        <nav aria-label={t("preferences")} className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
