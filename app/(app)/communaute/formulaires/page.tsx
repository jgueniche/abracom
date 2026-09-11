import { ClipboardListIcon } from "lucide-react";
import { CheckCircle2Icon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
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
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {forms.length === 0 ? (
        <EmptyState icon={ClipboardListIcon} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {forms.map((form) => {
            const status = formStatus(form);
            const mine = mineOnly(form.responses);
            const done = form.per_student
              ? mine.length >= Math.max(1, children.length)
              : mine.length > 0;
            return (
              <li key={form.id}>
                <Link
                  href={`/communaute/formulaires/${form.id}`}
                  className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant={status === "open" ? "default" : "outline"}>
                        {t(`status.${status}`)}
                      </Badge>
                      {mine.length > 0 && (
                        <Badge variant="secondary">
                          <CheckCircle2Icon aria-hidden />
                          {form.per_student && children.length > 1
                            ? t("childrenDone", { done: mine.length, total: children.length })
                            : t("answered")}
                        </Badge>
                      )}
                      {status === "open" && !done && (
                        <Badge variant="destructive">{t("toAnswer")}</Badge>
                      )}
                    </div>
                    <p className="truncate font-medium">{form.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {form.closes_at
                        ? t("closesOn", {
                            date: format.dateTime(new Date(form.closes_at), {
                              dateStyle: "medium",
                            }),
                          })
                        : ""}
                      {form.per_student ? ` · ${t("perStudent")}` : ""}
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
