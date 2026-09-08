import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SiteHeader } from "@/components/layouts/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appName } from "@/lib/env";

const STACK_ITEMS = ["next", "ui", "i18n", "theme", "supabase", "quality"] as const;

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:py-16">
        <section className="flex flex-col gap-4">
          <Badge variant="secondary" className="w-fit">
            {t("eyebrow")}
          </Badge>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            {t("title", { appName })}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("subtitle")}</p>
        </section>

        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{t("stack.title")}</CardTitle>
              <CardDescription>{t("stack.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {STACK_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
                    <span>{t(`stack.items.${item}`)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-muted/40">
            <CardHeader>
              <CardTitle>{t("next.title")}</CardTitle>
              <CardDescription>{t("next.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="min-h-11">
                <a
                  href="https://github.com/jgueniche/abracom/blob/HEAD/docs/ROADMAP.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("roadmap")}
                  <ArrowRightIcon aria-hidden />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
