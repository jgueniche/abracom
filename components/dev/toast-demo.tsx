"use client";

import { BellRingIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ToastDemo() {
  const t = useTranslations("devUi.feedback");
  return (
    <Button variant="outline" className="min-h-11" onClick={() => toast.success(t("toastMessage"))}>
      <BellRingIcon aria-hidden />
      {t("toast")}
    </Button>
  );
}
