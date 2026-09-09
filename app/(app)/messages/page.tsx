import { MessageCircleIcon, PlusIcon, UsersRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { canWriteInSchool } from "@/lib/permissions";
import { getMyThreads } from "@/server/queries/messaging";

import { ThreadList } from "./_components/thread-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("messaging");
  return { title: t("title") };
}

export default async function MessagesPage() {
  const user = await requireCurrentUser();
  const [t, threads] = await Promise.all([getTranslations("messaging"), getMyThreads()]);
  // Groups are the school team's tool; parents keep direct messages.
  const canCreateGroup = user.school ? canWriteInSchool(user.roles, user.school.id) : false;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            {canCreateGroup && (
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/messages/nouveau-groupe">
                  <UsersRoundIcon aria-hidden />
                  {t("group.new")}
                </Link>
              </Button>
            )}
            <Button asChild className="min-h-11">
              <Link href="/messages/nouveau">
                <PlusIcon aria-hidden />
                {t("new")}
              </Link>
            </Button>
          </>
        }
      />
      {threads.length === 0 ? (
        <EmptyState
          icon={MessageCircleIcon}
          title={t("empty")}
          description={t("emptyHint")}
          action={{ href: "/messages/nouveau", label: t("new") }}
        />
      ) : (
        <ThreadList threads={threads} className="max-w-3xl" />
      )}
    </>
  );
}
