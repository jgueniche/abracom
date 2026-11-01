"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * The answer key, folded until a parent asks for it — on screen and on paper alike: printed
 * with the sheet, it would hand the child the answers. Unfolded, it prints on a page of its
 * own, after the exercises.
 */
export function AnswerKey({
  showLabel,
  hideLabel,
  children,
}: {
  showLabel: string;
  hideLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-8">
      <Button
        type="button"
        variant="outline"
        className="min-h-11 cursor-pointer"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
        {open ? hideLabel : showLabel}
      </Button>
      {open && <div className="mt-6 print:mt-0 print:break-before-page">{children}</div>}
    </div>
  );
}
