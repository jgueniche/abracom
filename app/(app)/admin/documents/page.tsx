import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Row, RowList } from "@/components/domain/row-list";
import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { SectionHeader } from "@/components/layouts/section-header";
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
    <Column>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.name || "none"}>
              <SectionHeader label={group.name || tDocs("noFolder")} count={group.items.length} />
              <RowList>
                {group.items.map((doc) => (
                  <Row
                    key={doc.id}
                    href={`/admin/documents/${doc.id}`}
                    kind={doc.published_at ? undefined : t("draft")}
                    urgent={!doc.published_at}
                    title={doc.title}
                    detail={[
                      tDocs(`purpose.${doc.purpose}`),
                      doc.requires_signature
                        ? t("signedCount", { count: doc.signatures.length })
                        : null,
                      doc.published_at
                        ? format.dateTime(new Date(doc.published_at), { dateStyle: "medium" })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ))}
              </RowList>
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
    </Column>
  );
}
