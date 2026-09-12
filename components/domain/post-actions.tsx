"use client";

import { MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteClassPost } from "@/server/actions/class-posts";

/**
 * Administration of a post lives in a menu, and deleting asks first.
 * "Supprimer le billet" used to sit at the bottom of every card as a plain
 * button that destroyed the post on the first click.
 */
export function PostActions({ postId }: { postId: string }) {
  const t = useTranslations("classSpace");
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("actions")}
            className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:size-9"
          >
            <MoreHorizontalIcon className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2Icon aria-hidden />
            {t("post.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("post.delete")}</DialogTitle>
            <DialogDescription>{t("post.deleteConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => setConfirming(false)}
            >
              {t("post.cancel")}
            </Button>
            <form action={deleteClassPost} onSubmit={() => setConfirming(false)}>
              <input type="hidden" name="postId" value={postId} />
              <Button type="submit" variant="destructive" className="min-h-11">
                <Trash2Icon aria-hidden />
                {t("post.delete")}
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
