import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { Row, RowList } from "@/components/domain/row-list";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
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
    <Column>
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
        <p className="text-sm text-muted-foreground">{tf("empty")}</p>
      ) : (
        <RowList>
          {forms.map((form) => {
            const status = formStatus(form);
            return (
              <Row
                key={form.id}
                href={`/admin/formulaires/${form.id}`}
                kind={tf(`status.${status}`)}
                urgent={status === "open"}
                title={form.title}
                detail={[
                  t("responses", { count: form.responses.length }),
                  form.closes_at
                    ? tf("closesOn", {
                        date: format.dateTime(new Date(form.closes_at), { dateStyle: "medium" }),
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            );
          })}
        </RowList>
      )}
    </Column>
  );
}
