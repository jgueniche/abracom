import { CheckCircle2Icon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { ChildClassCard } from "@/components/domain/child-class-card";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CurrentUser } from "@/lib/auth/session";

import { UpcomingEvents } from "@/app/(app)/agenda/_components/upcoming-events";
import { getPendingAcknowledgements } from "@/server/queries/announcements";
import { getMyChildren } from "@/server/queries/family";

export async function ParentHome({ user }: { user: CurrentUser }) {
  const [t, format, children, pending] = await Promise.all([
    getTranslations("appHome"),
    getFormatter(),
    getMyChildren(),
    getPendingAcknowledgements(user.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={format.dateTime(new Date(), { weekday: "long", day: "numeric", month: "long" })}
        title={t("greeting", { name: user.profile.first_name })}
        description={t("parent.title")}
      />

      {/* Something is only worth a red card when something is actually waiting. */}
      {pending.length > 0 ? (
        <Link href="/annonces" className="group mb-8 block">
          <Card className="border-brick/40 transition-colors group-hover:bg-accent/40">
            <CardContent className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brick/10 text-sm font-semibold text-brick tabular-nums">
                {pending.length}
              </span>
              <div className="flex min-w-0 flex-col">
                <p className="font-medium">{t("parent.pendingAcks", { count: pending.length })}</p>
                <p className="text-sm text-muted-foreground">{t("parent.pendingHint")}</p>
              </div>
              <ChevronRightIcon
                className="ml-auto size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </CardContent>
          </Card>
        </Link>
      ) : (
        <p className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2Icon className="size-4 text-success" aria-hidden />
          {t("parent.pendingAcks", { count: 0 })}
        </p>
      )}

      <div className="grid gap-8 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2>{t("parent.children")}</h2>
            <Button asChild variant="ghost" size="sm" className="min-h-11">
              <Link href="/famille">
                {t("parent.seeFamily")}
                <ChevronRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">{t("parent.childrenHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2">
            {children.map((child) => (
              <ChildClassCard key={child.student.id} child={child} />
            ))}
          </div>
        </section>
        <UpcomingEvents userId={user.id} />
      </div>
    </>
  );
}
