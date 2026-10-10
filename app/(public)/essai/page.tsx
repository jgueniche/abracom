import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/components/ui/link";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { appName } from "@/lib/env";

import { TestSpaceForm } from "./test-space-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("testSchool");
  // A door for those who were given its password: nothing to index.
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The door of the test school (ADR-0073), reached from a corner of the sign-in
 * page. Whoever holds the test password chooses a character and enters a school
 * whose families, classes and messages are fictitious — the direction tries a
 * feature there before using it in the real one.
 */
export default async function TestSpacePage() {
  const t = await getTranslations("testSchool");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col">
        <p className="eyebrow mb-2 text-primary/85">{appName}</p>
        <h1>{t("title")}</h1>
        <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{t("intro")}</p>
      </div>
      <TestSpaceForm />
      <Link
        href={LOGIN_PATH}
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        {t("back")}
      </Link>
    </div>
  );
}
