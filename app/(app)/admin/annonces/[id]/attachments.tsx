"use client";

import { PaperclipIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ActionMessage } from "@/components/forms/action-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { idle } from "@/server/actions/admin/_shared-client";
import { deleteAttachment, uploadAttachment } from "@/server/actions/admin/announcements";

export function Attachments({
  announcementId,
  files,
}: {
  announcementId: string;
  files: Array<{ id: string; filename: string; size_bytes: number }>;
}) {
  const t = useTranslations("adminAnnouncements");
  const [state, action] = useActionState(uploadAttachment, idle);
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <PaperclipIcon className="size-4" aria-hidden />
              {f.filename}{" "}
              <span className="text-xs text-muted-foreground">
                ({Math.round(f.size_bytes / 1024)} Ko)
              </span>
            </span>
            <form action={deleteAttachment}>
              <input type="hidden" name="attachmentId" value={f.id} />
              <Button type="submit" variant="ghost" size="icon" aria-label={t("detach")}>
                <XIcon />
              </Button>
            </form>
          </li>
        ))}
      </ul>
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={announcementId} />
        <Input name="file" type="file" required className="min-h-11" />
        <div className="flex items-center gap-3">
          <SubmitButton variant="outline" size="sm" className="min-h-10">
            {t("attach")}
          </SubmitButton>
          <ActionMessage status={state.status} message={state.message} />
        </div>
      </form>
    </div>
  );
}
