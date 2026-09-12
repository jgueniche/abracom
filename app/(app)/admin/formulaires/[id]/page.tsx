import { FileDownIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollRegion } from "@/components/domain/scroll-region";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { utcToZonedNaive } from "@/lib/calendar/dates";
import { TIME_ZONE } from "@/lib/i18n/config";
import { deleteForm } from "@/server/actions/community";
import { getAudienceOptions } from "@/server/queries/announcements";
import { getForm, getFormResponses } from "@/server/queries/community";

import { FormBuilder, type FormInitial } from "../form-builder";

function display(value: unknown, yes: string, no: string): string {
  if (value === true) return yes;
  if (value === false) return no;
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

export default async function AdminFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { schoolId } = await requireSchoolStaff();
  const [t, tf, format, locale, form, responses, options] = await Promise.all([
    getTranslations("community.admin"),
    getTranslations("community.forms"),
    getFormatter(),
    getLocale(),
    getForm(id),
    getFormResponses(id),
    getAudienceOptions(schoolId),
  ]);
  if (!form) notFound();
  const initial: FormInitial = {
    id: form.id,
    title: form.title,
    descriptionMd: form.description_md ?? "",
    audience: form.audience,
    targetIds: form.target_ids,
    perStudent: form.per_student,
    opensAt: form.opens_at ? utcToZonedNaive(form.opens_at, TIME_ZONE) : "",
    closesAt: form.closes_at ? utcToZonedNaive(form.closes_at, TIME_ZONE) : "",
    fields: form.fields,
  };

  return (
    <Column width="full">
      <PageHeader
        title={form.title}
        description={t("responses", { count: responses.length })}
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/communaute/formulaires/${form.id}`}>{t("open")}</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <a href={`/api/forms/${form.id}/export`}>
                <FileDownIcon aria-hidden />
                {t("export")}
              </a>
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-8">
        <Card>
          <CardHeader>
            <CardTitle>{t("results")}</CardTitle>
          </CardHeader>
          <CardContent>
            {responses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noResponses")}</p>
            ) : (
              <ScrollRegion label={t("responses")} className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-sm text-muted-foreground">
                      <th className="py-1 pr-3 font-medium">{t("respondent")}</th>
                      {form.per_student && (
                        <th className="py-1 pr-3 font-medium">{t("student")}</th>
                      )}
                      <th className="py-1 pr-3 font-medium">{t("submittedAt")}</th>
                      {form.fields.map((f) => (
                        <th key={f.id} className="py-1 pr-3 font-medium">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {responses.map((r) => {
                      const answers = (r.answers ?? {}) as Record<string, unknown>;
                      return (
                        <tr key={r.id} className="border-t align-top">
                          <td className="py-1 pr-3 whitespace-nowrap">
                            {r.user ? `${r.user.first_name} ${r.user.last_name}` : "—"}
                          </td>
                          {form.per_student && (
                            <td className="py-1 pr-3 whitespace-nowrap">
                              {r.student ? `${r.student.first_name} ${r.student.last_name}` : "—"}
                            </td>
                          )}
                          <td className="py-1 pr-3 whitespace-nowrap">
                            {format.dateTime(new Date(r.submitted_at), {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          {form.fields.map((f) => (
                            <td key={f.id} className="py-1 pr-3">
                              {display(answers[f.id], tf("yes"), tf("no"))}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollRegion>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("editForm")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FormBuilder
              options={{ levels: options.levels, classes: options.classes, users: options.users }}
              locale={locale}
              initial={initial}
            />
          </CardContent>
        </Card>
        <form action={deleteForm} className="border-t pt-6">
          <input type="hidden" name="id" value={form.id} />
          <Button type="submit" variant="destructive" className="min-h-11">
            <Trash2Icon aria-hidden />
            {t("delete")}
          </Button>
        </form>
      </div>
    </Column>
  );
}
