import { getFormatter, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/layouts/page-header";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { getAuditLog } from "@/server/queries/admin";

export default async function AuditPage() {
  const { schoolId } = await requireSchoolAdmin();
  const [t, format, entries] = await Promise.all([
    getTranslations("admin.audit"),
    getFormatter(),
    getAuditLog(schoolId),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {entries.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{t("when")}</th>
                <th className="px-3 py-2 font-medium">{t("who")}</th>
                <th className="px-3 py-2 font-medium">{t("action")}</th>
                <th className="px-3 py-2 font-medium">{t("entity")}</th>
                <th className="px-3 py-2 font-medium">{t("details")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t align-top">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {format.dateTime(new Date(entry.created_at), {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {entry.actor ? `${entry.actor.first_name} ${entry.actor.last_name}` : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.action}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {entry.entity}
                    {entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}` : ""}
                  </td>
                  <td className="max-w-md px-3 py-2 font-mono text-xs break-all text-muted-foreground">
                    {entry.diff ? JSON.stringify(entry.diff) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
