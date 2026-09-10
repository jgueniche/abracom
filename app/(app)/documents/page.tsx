import { CheckCircle2Icon, DownloadIcon, FileTextIcon } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth/session";
import { isSchoolStaff } from "@/lib/permissions";
import { getDocumentsForUser, groupByFolder } from "@/server/queries/documents";
import { getMyChildren } from "@/server/queries/family";

import { SignForm } from "./sign-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("documents");
  return { title: t("title") };
}

export default async function DocumentsPage() {
  const user = await requireCurrentUser();
  const [t, format, documents, children] = await Promise.all([
    getTranslations("documents"),
    getFormatter(),
    getDocumentsForUser(),
    getMyChildren(),
  ]);
  const isParent = user.roles.some((r) => r.role === "parent" && r.status === "active");
  const canPublish = user.school ? isSchoolStaff(user.roles, user.school.id) : false;
  const groups = groupByFolder(documents);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {documents.length === 0 && (
        <EmptyState
          icon={FileTextIcon}
          title={t("empty")}
          description={t("emptyHint")}
          action={canPublish ? { href: "/admin/documents", label: t("deposit") } : undefined}
        />
      )}
      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <section key={group.name || "none"} className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">{group.name || t("noFolder")}</h2>
            {group.items.map((doc) => {
              const mine = doc.signatures.filter((s) => s.user_id === user.id);
              const familySigned = mine.find((s) => s.student_id === null);
              return (
                <Card key={doc.id}>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <FileTextIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                        <div className="min-w-0">
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {t(`purpose.${doc.purpose}`)} · {t("version", { version: doc.version })}
                            {doc.published_at
                              ? ` · ${format.dateTime(new Date(doc.published_at), { dateStyle: "medium" })}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm" className="min-h-11">
                        <a href={`/documents/${doc.id}/fichier`}>
                          <DownloadIcon aria-hidden />
                          {t("download")}
                        </a>
                      </Button>
                    </div>
                    {doc.requires_signature && (
                      <div className="flex flex-col gap-3 border-t pt-3">
                        {!isParent ? (
                          <p className="text-sm text-muted-foreground">{t("readOnlyGuardian")}</p>
                        ) : doc.signature_per_student ? (
                          children.map((child) => {
                            const signed = doc.signatures.find(
                              (s) => s.student_id === child.student.id,
                            );
                            const name = `${child.student.first_name} ${child.student.last_name}`;
                            return signed ? (
                              <Badge key={child.student.id} variant="secondary" className="w-fit">
                                <CheckCircle2Icon aria-hidden />
                                {t("signedFor", {
                                  name,
                                  date: format.dateTime(new Date(signed.signed_at), {
                                    dateStyle: "medium",
                                  }),
                                })}
                              </Badge>
                            ) : (
                              <SignForm
                                key={child.student.id}
                                documentId={doc.id}
                                studentId={child.student.id}
                                label={t("signFor", { name })}
                              />
                            );
                          })
                        ) : familySigned ? (
                          <Badge variant="secondary" className="w-fit">
                            <CheckCircle2Icon aria-hidden />
                            {t("signedOn", {
                              date: format.dateTime(new Date(familySigned.signed_at), {
                                dateStyle: "medium",
                              }),
                            })}
                          </Badge>
                        ) : (
                          <SignForm documentId={doc.id} label={t("sign")} />
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}
