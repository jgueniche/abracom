"use client";

import { DownloadIcon, FileUpIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IMPORT_COLUMNS } from "@/lib/import/families";
import {
  commitImport,
  type ImportCommitState,
  type ImportPreviewState,
  previewImport,
} from "@/server/actions/admin/import";

const previewInitial: ImportPreviewState = { status: "idle" };
const commitInitial: ImportCommitState = { status: "idle" };

export function ImportWizard() {
  const t = useTranslations("admin.import");
  const [preview, previewAction] = useActionState(previewImport, previewInitial);
  const [commit, commitAction] = useActionState(commitImport, commitInitial);

  if (commit.status !== "idle" && commit.counts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{commit.message}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(commit.counts) as Array<keyof typeof commit.counts>).map((key) => (
              <div key={key} className="rounded-xl border p-3">
                <dt className="text-xs text-muted-foreground">{t(`counts.${key}`)}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{commit.counts![key]}</dd>
              </div>
            ))}
          </dl>
          {commit.errors && commit.errors.length > 0 && (
            <ul className="list-inside list-disc text-sm text-destructive">
              {commit.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <p className="text-sm">{t("next")}</p>
          <div className="flex gap-2">
            <Button asChild className="min-h-11">
              <Link href="/admin/utilisateurs">{t("goMembers")}</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/admin/import">{t("restart")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const ready = preview.status === "success" && preview.csvText;

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <form action={previewAction} className="flex flex-col gap-3">
              <Label htmlFor="file">{t("file")}</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".csv,text/csv"
                required
                className="min-h-11"
              />
              <SubmitButton className="self-start" variant="outline">
                <FileUpIcon aria-hidden />
                {t("preview")}
              </SubmitButton>
            </form>
            <ActionMessage status={preview.status} message={preview.message} />
            {preview.rowCount !== undefined && (
              <p className="text-sm text-muted-foreground">
                {t("stats", {
                  rows: preview.rowCount,
                  classes: preview.classNames?.length ?? 0,
                  emails: preview.emails ?? 0,
                })}
              </p>
            )}
            {preview.unknownClasses && preview.unknownClasses.length > 0 && (
              <div className="text-sm text-destructive">
                <p>{t("unknownClasses", { classes: preview.unknownClasses.join(", ") })}</p>
                <p className="text-muted-foreground">{t("unknownClassesHint")}</p>
              </div>
            )}
            {preview.issues && preview.issues.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-xl border">
                <table className="w-full text-sm">
                  <caption className="sr-only">{t("issues")}</caption>
                  <tbody>
                    {preview.issues.map((issue, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                          {t("line", { line: issue.line })}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">{issue.column ?? ""}</td>
                        <td className="px-3 py-1.5">{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {ready && (
              <form action={commitAction} className="border-t pt-4">
                <input type="hidden" name="csvText" value={preview.csvText} />
                <SubmitButton pendingLabel={t("importing")}>
                  <UploadIcon aria-hidden />
                  {t("commit")}
                </SubmitButton>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="self-start">
        <CardHeader>
          <CardTitle>{t("columns")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t("requiredColumns")}</p>
          <ul className="flex flex-wrap gap-1.5">
            {IMPORT_COLUMNS.map((column) => (
              <li key={column} className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
                {column}
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="min-h-11 self-start">
            <a href="/admin/import/modele" download="modele-familles.csv">
              <DownloadIcon aria-hidden />
              {t("template")}
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
