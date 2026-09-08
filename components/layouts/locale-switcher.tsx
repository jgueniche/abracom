"use client";

import { LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, type Locale } from "@/lib/i18n/config";
import { setLocale } from "@/lib/i18n/locale";

export function LocaleSwitcher() {
  const t = useTranslations("common");
  const current = useLocale();
  const [isPending, startTransition] = useTransition();

  function onSelect(value: string) {
    startTransition(async () => {
      await setLocale(value as Locale);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("language")}
          className="size-11"
          disabled={isPending}
        >
          <LanguagesIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={current} onValueChange={onSelect}>
          {locales.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale}>
              {t(`locale.${locale}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
