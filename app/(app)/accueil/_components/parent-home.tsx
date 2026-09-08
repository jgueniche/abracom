import { CheckCircle2Icon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { StudentCard } from "@/components/domain/student-card";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CurrentUser } from "@/lib/auth/session";

import { UpcomingEvents } from "@/app/(app)/agenda/_components/upcoming-events";
import { getPendingAcknowledgements } from "@/server/queries/announcements";
import { getMyChildren } from "@/server/queries/family";

export async function ParentHome({ user }: { user: CurrentUser }) {
  const t = await getTranslations("appHome");
  const [children, pending] = await Promise.all([
    getMyChildren(),
    getPendingAcknowledgements(user.id),
  ]);

  return (
    <>
      <PageHeader
        title={t("greeting", { name: user.profile.first_name })}
        description={t("parent.title")}
      />
      <Card className="mb-6">
        <CardContent className="flex items-center gap-3">
          <CheckCircle2Icon className="size-5 shrink-0 text-primary" aria-hidden />
          <div className="flex flex-col">
            <p className="font-medium">{t("parent.pendingAcks", { count: pending.length })}</p>
            <p className="text-sm text-muted-foreground">{t("parent.pendingHint")}</p>
          </div>
        </CardContent>
      </Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("parent.children")}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/famille">
            {t("parent.seeFamily")}
            <ChevronRightIcon aria-hidden />
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {children.map((child) => (
          <StudentCard key={child.student.id} child={child} compact />
        ))}
      </div>
      <UpcomingEvents userId={user.id} />
    </>
  );
}
