import { ChevronRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { formStatus, getForms } from "@/server/queries/community";

export default async function AdminFormsPage() {
  await requireSchoolStaff();
  const [t, tf, format, forms] = await Promise.all([
    getTranslations("community.admin"),
    getTranslations("community.forms"),
    getFormatter(),
    getForms(),
  ]);
  return (
    <>
      <PageHeader
        title={t("forms")}
        description={t("formsSubtitle")}
        actions={
          <Button asChild className="min-h-11">
            <Link href="/admin/formulaires/nouveau">
              <PlusIcon aria-hidden />
              {t("newForm")}
            </Link>
          </Button>
        }
      />
      {forms.length === 0 ? (
        <p className="text-muted-foreground">{tf("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {forms.map((form) => {
            const status = formStatus(form);
            return (
              <li key={form.id}>
                <Link
                  href={`/admin/formulaires/${form.id}`}
                  className="flex items-center gap-3 rounded-xl border p-3 hover:bg-accent/60"
                >
                  <Badge variant={status === "open" ? "default" : "outline"}>
                    {tf(`status.${status}`)}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{form.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("responses", { count: form.responses.length })}
                      {form.closes_at
                        ? ` · ${tf("closesOn", { date: format.dateTime(new Date(form.closes_at), { dateStyle: "medium" }) })}`
                        : ""}
                    </p>
                  </div>
                  <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
