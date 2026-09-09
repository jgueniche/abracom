import { ConstructionIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layouts/page-header";

/** Placeholder for sections delivered in later sessions. */
export async function ComingSoon({ title }: { title: string }) {
  const t = await getTranslations("common");
  return (
    <>
      <PageHeader title={title} />
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/40 p-10 text-center text-muted-foreground">
        <ConstructionIcon className="size-8" aria-hidden />
        <p className="font-medium">{t("soon")}</p>
        <p className="text-sm">{t("soonHint")}</p>
      </div>
    </>
  );
}
