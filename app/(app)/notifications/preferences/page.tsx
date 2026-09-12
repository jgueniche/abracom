import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { getNotificationPreferences } from "@/server/queries/notifications";

import { PreferencesForm } from "../_components/preferences-form";
import { PushToggle } from "../_components/push-toggle";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notificationPrefs");
  return { title: t("title") };
}

export default async function NotificationPreferencesPage() {
  const user = await requireCurrentUser();
  const [t, tn, initial] = await Promise.all([
    getTranslations("notificationPrefs"),
    getTranslations("notifications"),
    getNotificationPreferences(user.id),
  ]);
  return (
    <Column width="text">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/notifications">
          <ArrowLeftIcon aria-hidden />
          {tn("title")}
        </Link>
      </Button>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardContent>
            <PreferencesForm initial={initial} />
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("push.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PushToggle publicKey={publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
          </CardContent>
        </Card>
      </div>
    </Column>
  );
}
