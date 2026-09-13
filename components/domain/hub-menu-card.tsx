"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * A hub entry that has to ask *where* before it can go.
 *
 * "Publier" answers one question — what do I want to publish? — and the class
 * is a detail of the answer, not a second screen. A teacher with one class
 * never sees the menu at all: {@link HubCard} is used instead.
 */
export function HubMenuCard({
  title,
  hint,
  classes,
  href,
}: {
  title: string;
  hint?: string;
  classes: Array<{ id: string; name: string }>;
  href: (classId: string) => string;
}) {
  const t = useTranslations("publish");

  return (
    <li className="border-b border-rule">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group -mx-3 flex min-h-14 w-[calc(100%+1.5rem)] items-baseline gap-4 rounded-md px-3 py-3.5 text-left transition-colors hover:bg-muted/50"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold tracking-[-0.006em]">{title}</span>
              {hint && <span className="mt-0.5 block text-sm text-muted-foreground">{hint}</span>}
            </span>
            <ChevronRightIcon
              className="size-3.5 shrink-0 self-center text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{t("chooseClass")}</DropdownMenuLabel>
          {classes.map((cls) => (
            <DropdownMenuItem key={cls.id} asChild className="min-h-11 px-2">
              <Link href={href(cls.id)}>{cls.name}</Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
