import { ClipboardListIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { Row, RowList } from "@/components/domain/row-list";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { requireCurrentUser } from "@/lib/auth/session";
import { formStatus, getForms } from "@/server/queries/community";
import { getMyChildren } from "@/server/queries/family";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community.forms");
  return { title: t("title") };
}

export default async function FormsPage() {
  const user = await requireCurrentUser();
  const [t, format, forms, children] = await Promise.all([
    getTranslations("community.forms"),
    getFormatter(),
    getForms(),
    getMyChildren(),
  ]);
  const mineOnly = (responses: Array<{ user_id: string }>) =>
    responses.filter((r) => r.user_id === user.id);

  return (
    <Column>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {forms.length === 0 ? (
        <EmptyState icon={ClipboardListIcon} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <RowList>
          {forms.map((form) => {
            const status = formStatus(form);
            const mine = mineOnly(form.responses);
            const done = form.per_student
              ? mine.length >= Math.max(1, children.length)
              : mine.length > 0;
            return (
              <Row
                key={form.id}
                href={`/communaute/formulaires/${form.id}`}
                kind={status === "open" && !done ? t("toAnswer") : t(`status.${status}`)}
                urgent={status === "open" && !done}
                title={form.title}
                detail={[
                  mine.length > 0
                    ? form.per_student && children.length > 1
                      ? t("childrenDone", { done: mine.length, total: children.length })
                      : t("answered")
                    : null,
                  form.closes_at
                    ? t("closesOn", {
                        date: format.dateTime(new Date(form.closes_at), { dateStyle: "medium" }),
                      })
                    : null,
                  form.per_student ? t("perStudent") : null,
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
