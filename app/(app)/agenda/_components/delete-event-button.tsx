"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { deleteEvent } from "@/server/actions/agenda";

export function DeleteEventButton({ id }: { id: string }) {
  const t = useTranslations("agenda");
  return (
    <form
      action={deleteEvent}
      onSubmit={(event) => {
        if (!window.confirm(t("deleteConfirm"))) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" className="min-h-11">
        <Trash2Icon aria-hidden />
        {t("delete")}
      </Button>
    </form>
  );
}
