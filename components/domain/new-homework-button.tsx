"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * "Nouveau devoir", wherever a teacher looks for it.
 *
 * Setting homework was only reachable by opening a class, then the generic
 * composer, then changing a select from "Cahier de vie" to "Devoir" — three
 * steps and a guess. With one class this is a single link; with several, the
 * choice of class is the only question left.
 */
export function NewHomeworkButton({
  classes,
  variant = "default",
}: {
  classes: Array<{ id: string; name: string }>;
  variant?: "default" | "outline";
}) {
  const t = useTranslations("diary");
  const href = (id: string) => `/classes/${id}/publier?type=homework`;

  if (classes.length === 0) return null;
  if (classes.length === 1)
    return (
      <Button asChild variant={variant} className="min-h-11">
        <Link href={href(classes[0]!.id)}>
          <PlusIcon aria-hidden />
          {t("newHomework")}
        </Link>
      </Button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} className="min-h-11">
          <PlusIcon aria-hidden />
          {t("newHomework")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("newHomework")}</DropdownMenuLabel>
        {classes.map((cls) => (
          <DropdownMenuItem key={cls.id} asChild className="min-h-11 px-2">
            <Link href={href(cls.id)}>{cls.name}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
