"use client";

import { PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** Prints the page as the print stylesheet sets it: the content, without the application. */
export function PrintButton({ label }: { label?: string }) {
  const t = useTranslations("viewer");
  return (
    <Button type="button" variant="outline" className="min-h-11" onClick={() => window.print()}>
      <PrinterIcon aria-hidden />
      {label ?? t("print")}
    </Button>
  );
}
