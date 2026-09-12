"use client";

import { BoldIcon, EyeIcon, ItalicIcon, LinkIcon, ListIcon, PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { Markdown } from "@/components/domain/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Markdown textarea with a small toolbar and a live preview (tiptap deferred, ADR-0017). */
export function MarkdownEditor({
  name,
  defaultValue = "",
  label,
  rows = 10,
  required,
}: {
  name: string;
  defaultValue?: string;
  label: string;
  rows?: number;
  required?: boolean;
}) {
  const t = useTranslations("editor");
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);

  function wrap(before: string, after = before, placeholder = "") {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function prefixLines(prefix: string) {
    const el = ref.current;
    if (!el) return;
    const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const end = el.selectionEnd;
    const block = value.slice(start, end);
    const next = `${value.slice(0, start)}${block
      .split("\n")
      .map((line) => `${prefix}${line}`)
      .join("\n")}${value.slice(end)}`;
    setValue(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("bold")}
            onClick={() => wrap("**", "**", t("boldPlaceholder"))}
          >
            <BoldIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("italic")}
            onClick={() => wrap("_", "_", t("italicPlaceholder"))}
          >
            <ItalicIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("list")}
            onClick={() => prefixLines("- ")}
          >
            <ListIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("link")}
            onClick={() => wrap("[", "](https://)", t("linkPlaceholder"))}
          >
            <LinkIcon />
          </Button>
          <Button
            type="button"
            variant={preview ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? <PencilIcon /> : <EyeIcon />}
            {preview ? t("edit") : t("preview")}
          </Button>
        </div>
      </div>
      {preview ? (
        <div className="min-h-32 rounded-xl border bg-muted/30 p-3">
          <Markdown size="compact">{value || t("empty")}</Markdown>
        </div>
      ) : null}
      <Textarea
        ref={ref}
        id={id}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={rows}
        required={required}
        className={preview ? "hidden" : undefined}
      />
      {preview && <input type="hidden" name={name} value={value} />}
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
