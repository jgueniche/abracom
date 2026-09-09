import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { Markdown } from "@/components/domain/markdown";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { canWriteInSchool } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formStatus, getForm, getMyFormResponses } from "@/server/queries/community";
import { getMyChildren } from "@/server/queries/family";

import { FormFill } from "../../_components/form-fill";

export default async function FormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { id } = await params;
  const { s } = await searchParams;
  const user = await requireCurrentUser();
  const [t, format, form, responses, children] = await Promise.all([
    getTranslations("community.forms"),
    getFormatter(),
    getForm(id),
    getMyFormResponses(id, user.id),
    getMyChildren(),
  ]);
  if (!form) notFound();
  const status = formStatus(form);
  const kids = children.map((c) => ({
    id: c.student.id,
    name: `${c.student.first_name} ${c.student.last_name}`,
  }));
  const studentId = form.per_student
    ? (kids.find((k) => k.id === s)?.id ?? kids[0]?.id ?? null)
    : null;
  const existing = responses.find((r) =>
    form.per_student ? r.student_id === studentId : r.student_id === null,
  );

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/communaute/formulaires">
          <ArrowLeftIcon aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        title={form.title}
        description={
          form.closes_at
            ? t("closesOn", {
                date: format.dateTime(new Date(form.closes_at), {
                  dateStyle: "long",
                  timeStyle: "short",
                }),
              })
            : undefined
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant={status === "open" ? "default" : "outline"}>{t(`status.${status}`)}</Badge>
        {existing && (
          <Badge variant="secondary">
            {t("answeredOn", {
              date: format.dateTime(new Date(existing.submitted_at), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </Badge>
        )}
      </div>
      {form.description_md && (
        <Card className="mb-6">
          <CardContent>
            <Markdown>{form.description_md}</Markdown>
          </CardContent>
        </Card>
      )}
      {form.per_student && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium">{t("chooseChild")}</p>
          {kids.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("childRequired")}</p>
          ) : (
            <nav className="flex flex-wrap gap-2">
              {kids.map((kid) => {
                const done = responses.some((r) => r.student_id === kid.id);
                return (
                  <Link
                    key={kid.id}
                    href={`/communaute/formulaires/${form.id}?s=${kid.id}`}
                    aria-current={kid.id === studentId ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium",
                      kid.id === studentId
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent",
                    )}
                  >
                    {kid.name}
                    {done ? " ✓" : ""}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      )}
      {status === "closed" && !existing && (
        <p className="mb-4 text-sm text-muted-foreground">{t("closed")}</p>
      )}
      {(!form.per_student || studentId) && (
        <Card>
          <CardContent>
            <FormFill
              formId={form.id}
              studentId={studentId}
              fields={form.fields}
              answers={(existing?.answers as Record<string, unknown> | null) ?? {}}
              disabled={status !== "open" || !canWriteInSchool(user.roles, form.school_id)}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
