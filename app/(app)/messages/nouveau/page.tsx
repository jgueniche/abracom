import { ArrowLeftIcon, MessageSquarePlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/session";
import { openDm } from "@/server/actions/messaging";
import { getDmContacts } from "@/server/queries/messaging";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("messaging.contacts");
  return { title: t("title") };
}

export default async function NewMessagePage() {
  await requireCurrentUser();
  const [t, tRoles, contacts] = await Promise.all([
    getTranslations("messaging"),
    getTranslations("roles"),
    getDmContacts(),
  ]);
  const team = contacts.filter((c) => c.role !== "parent");
  const parents = contacts.filter((c) => c.role === "parent");

  const list = (rows: typeof contacts) => (
    <ul className="flex flex-col gap-2">
      {rows.map((c) => (
        <li
          key={`${c.user_id}-${c.role}`}
          className="flex items-center justify-between gap-3 rounded-xl border p-3"
        >
          <div className="min-w-0">
            <p className="font-medium">
              {c.first_name} {c.last_name}{" "}
              <Badge variant="outline" className="ml-1">
                {tRoles(c.role)}
              </Badge>
            </p>
            {c.class_names && (
              <p className="truncate text-sm text-muted-foreground">{c.class_names}</p>
            )}
          </div>
          <form action={openDm}>
            <input type="hidden" name="userId" value={c.user_id} />
            <Button type="submit" size="sm" className="min-h-11">
              <MessageSquarePlusIcon aria-hidden />
              {t("contacts.write")}
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/messages">
          <ArrowLeftIcon aria-hidden />
          {t("title")}
        </Link>
      </Button>
      <PageHeader title={t("contacts.title")} description={t("contacts.subtitle")} />
      {contacts.length === 0 && <p className="text-muted-foreground">{t("contacts.empty")}</p>}
      <div className="flex flex-col gap-6">
        {team.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">{t("contacts.team")}</h2>
            {list(team)}
          </section>
        )}
        {parents.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">{t("contacts.parents")}</h2>
            {list(parents)}
          </section>
        )}
      </div>
    </>
  );
}
