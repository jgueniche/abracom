import { ChevronRightIcon, FileTextIcon } from "lucide-react";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { getAudienceOptions } from "@/server/queries/announcements";
import { getAdminDocuments, groupByFolder } from "@/server/queries/documents";

import { DocumentForm } from "./document-form";

export default async function AdminDocumentsPage() {
  const { schoolId } = await requireSchoolStaff();
  const [t, tDocs, format, locale, { documents, folders }, options] = await Promise.all([
    getTranslations("adminDocuments"),
    getTranslations("documents"),
    getFormatter(),
    getLocale(),
    getAdminDocuments(schoolId),
    getAudienceOptions(schoolId),
  ]);
  const groups = groupByFolder(documents);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.name || "none"}>
              <SectionHeader label={group.name || tDocs("noFolder")} count={group.items.length} />
              <ul className="flex flex-col gap-2">
                {group.items.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/admin/documents/${doc.id}`}
                      className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/60"
                    >
                      <FileTextIcon className="size-5 shrink-0 text-primary" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {doc.title}
                          {!doc.published_at && (
                            <Badge variant="outline" className="ml-2">
                              {t("draft")}
                            </Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {tDocs(`purpose.${doc.purpose}`)}
                          {doc.requires_signature
                            ? ` · ${t("signedCount", { count: doc.signatures.length })}`
                            : ""}
                          {doc.published_at
                            ? ` · ${format.dateTime(new Date(doc.published_at), { dateStyle: "medium" })}`
                            : ""}
                        </p>
                      </div>
                      <ChevronRightIcon
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>{t("new")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentForm options={options} folders={folders} locale={locale} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
