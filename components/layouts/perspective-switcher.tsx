"use client";

import { ChevronsUpDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Perspective } from "@/lib/permissions";
import { switchPerspective } from "@/server/actions/perspective";

export function PerspectiveSwitcher({
  current,
  available,
}: {
  current: Perspective;
  available: Perspective[];
}) {
  const t = useTranslations("perspective");
  const [isPending, startTransition] = useTransition();

  if (available.length < 2) return null;

  function onChange(value: string) {
    const data = new FormData();
    data.set("perspective", value);
    startTransition(async () => {
      await switchPerspective(data);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-9" disabled={isPending}>
          {t(current)}
          <ChevronsUpDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current} onValueChange={onChange}>
          {available.map((p) => (
            <DropdownMenuRadioItem key={p} value={p}>
              {t(p)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
