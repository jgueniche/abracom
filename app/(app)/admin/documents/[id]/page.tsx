import { ArrowLeftIcon, DownloadIcon, Trash2Icon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollRegion } from "@/components/domain/scroll-region";
import { requireSchoolStaff } from "@/lib/auth/guards";
import { isSchoolAdmin } from "@/lib/permissions";
import { deleteDocument, publishDocument } from "@/server/actions/admin/documents";
import { getDocument, getMissingSignatures } from "@/server/queries/documents";

export default async function AdminDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, schoolId } = await requireSchoolStaff();
  const [t, tDocs, format, doc] = await Promise.all([
    getTranslations("adminDocuments"),
    getTranslations("documents"),
    getFormatter(),
    getDocument(id),
  ]);
  if (!doc || doc.deleted_at) notFound();
  const missing = doc.requires_signature ? await getMissingSignatures(id) : [];
  const admin = isSchoolAdmin(user.roles, schoolId);

  return (
    <Column width="full">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/documents">
          <ArrowLeftIcon aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        title={doc.title}
        description={`${tDocs(`purpose.${doc.purpose}`)} · ${tDocs("version", { version: doc.version })}${doc.published_at ? ` · ${format.dateTime(new Date(doc.published_at), { dateStyle: "long" })}` : ` · ${t("draft")}`}`}
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <a href={`/documents/${doc.id}/fichier`}>
                <DownloadIcon aria-hidden />
                {tDocs("download")}
              </a>
            </Button>
            {!doc.published_at && (
              <form action={publishDocument}>
                <input type="hidden" name="id" value={doc.id} />
                <Button type="submit" className="min-h-11">
                  <UploadIcon aria-hidden />
                  {t("publish")}
                </Button>
              </form>
            )}
            {admin && (
              <form action={deleteDocument}>
                <input type="hidden" name="id" value={doc.id} />
                <Button type="submit" variant="ghost" className="min-h-11 text-destructive">
                  <Trash2Icon aria-hidden />
                  {t("delete")}
                </Button>
              </form>
            )}
          </>
        }
      />
      {doc.requires_signature && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t("missingTitle")}{" "}
              <Badge variant={missing.length ? "destructive" : "secondary"} className="ml-2">
                {missing.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              {t("missing", { count: missing.length })} ·{" "}
              {t("signedCount", { count: doc.signatures.length })}
            </p>
            {missing.length === 0 ? (
              <p className="text-sm">{t("allSigned")}</p>
            ) : (
              <ScrollRegion label={t("signatures")} className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      {doc.signature_per_student && (
                        <th className="px-3 py-2 font-medium">{t("student")}</th>
                      )}
                      <th className="px-3 py-2 font-medium">{t("guardian")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missing.map((row) => (
                      <tr key={`${row.user_id}-${row.student_id ?? ""}`} className="border-t">
                        {doc.signature_per_student && (
                          <td className="px-3 py-2">{row.student_name}</td>
                        )}
                        <td className="px-3 py-2">
                          {row.last_name} {row.first_name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollRegion>
            )}
          </CardContent>
        </Card>
      )}
    </Column>
  );
}
