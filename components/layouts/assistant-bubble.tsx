"use client";

import { ArrowUpIcon, RotateCcwIcon, SparklesIcon, XIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { allowedLink, type AssistantLink } from "@/lib/assistant/plan";
import { cn } from "@/lib/utils";

/**
 * The assistant's bubble (ADR-0088): a round button in the corner of every page, above the
 * bottom bar on a phone, that opens a panel to ask a question in plain words — « quels devoirs
 * pour demain ? », « comment déclarer une absence ? ».
 *
 * The answer comes as it is written. Its links are drawn only when the server handed them over
 * for this answer — the screens the reader's roles open, the homework and events the tools
 * returned; any other address the model might write stays plain text. The conversation lives in
 * this tab (`sessionStorage`), never in the database.
 */

type Message = {
  role: "user" | "assistant";
  text: string;
  links?: AssistantLink[];
  error?: boolean;
};

const STORAGE_KEY = "kesher.assistant.v1";

/** An error whose message was written for the reader. */
class Shown extends Error {}

const ICON_BUTTON =
  "flex size-11 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50";

/** Screens where a floating button would sit on the page's own controls. */
const HIDDEN = [/^\/messages\/[^/]+$/, /\/nouveau$/, /\/modifier$/, /^\/pointage/, /\/publier$/];

export function AssistantBubble({ suggestions }: { suggestions: string[] }) {
  const t = useTranslations("assistant");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved) as Message[]);
    } catch {
      // A private window may refuse storage: the conversation simply starts empty.
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      // Nothing to do: the conversation still works for this page.
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  if (HIDDEN.some((pattern) => pattern.test(pathname))) return null;

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const history = [...messages.filter((m) => !m.error), { role: "user" as const, text }];
    setMessages([...history, { role: "assistant", text: "" }]);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-8).map(({ role, text }) => ({ role, text })),
        }),
      });
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !response.body || !type.includes("ndjson")) {
        // A session that has expired is sent to the sign-in page, which answers in HTML.
        const body = type.includes("json")
          ? ((await response.json().catch(() => null)) as { message?: string } | null)
          : null;
        throw new Shown(body?.message ?? t(response.redirected ? "errors.signedOut" : "error"));
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let links: AssistantLink[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          if (!raw.trim()) continue;
          const event = JSON.parse(raw) as {
            t: string;
            v?: string;
            links?: AssistantLink[];
            message?: string;
          };
          if (event.t === "links") links = event.links ?? [];
          if (event.t === "text") answer += event.v ?? "";
          if (event.t === "error") throw new Shown(event.message ?? t("error"));
          setMessages([...history, { role: "assistant", text: answer, links }]);
        }
      }
    } catch (error) {
      // Only the messages written for the reader are shown, never a technical one.
      const text = error instanceof Shown ? error.message : t("error");
      setMessages([...history, { role: "assistant", text, error: true }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(input);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("open")}
        title={t("open")}
        data-assistant-bubble=""
        className="no-print fixed right-4 bottom-[calc(var(--nav-h)+0.75rem)] z-40 flex size-14 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95 motion-reduce:transition-none lg:right-6 lg:bottom-6"
      >
        <SparklesIcon aria-hidden className="size-6" />
      </button>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="flex-row items-start gap-2 border-b border-border py-3 pr-2">
          <div className="min-w-0 flex-1 pt-1">
            <SheetTitle className="flex items-center gap-2 font-heading text-lg font-normal">
              <SparklesIcon aria-hidden className="size-4 text-primary" />
              {t("title")}
            </SheetTitle>
            <SheetDescription className="text-xs">{t("description")}</SheetDescription>
          </div>
          <div className="flex shrink-0">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                disabled={busy}
                aria-label={t("reset")}
                title={t("reset")}
                className={ICON_BUTTON}
              >
                <RotateCcwIcon aria-hidden className="size-4" />
              </button>
            )}
            <SheetClose className={ICON_BUTTON} aria-label={t("close")} title={t("close")}>
              <XIcon aria-hidden className="size-5" />
            </SheetClose>
          </div>
        </SheetHeader>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div>
              <p className="mb-3 text-sm text-pretty">{t("greeting")}</p>
              <ul className="flex flex-col items-start gap-2">
                {suggestions.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => void ask(suggestion)}
                      className="min-h-11 cursor-pointer rounded-full border border-border px-3.5 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="flex flex-col gap-4" aria-live="polite" aria-busy={busy}>
              {messages.map((message, index) => (
                <li
                  key={index}
                  className={cn(
                    message.role === "user"
                      ? "ml-10 self-end rounded-2xl rounded-br-sm bg-primary/10 px-3.5 py-2 text-sm"
                      : "mr-4 text-sm",
                  )}
                >
                  {message.role === "user" ? (
                    <span className="sr-only">{t("you")} : </span>
                  ) : (
                    <span className="sr-only">{t("assistant")} : </span>
                  )}
                  {message.role === "assistant" && message.text === "" && !message.error ? (
                    <span className="inline-flex gap-1 py-2" aria-label={t("thinking")}>
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse"
                          style={{ animationDelay: `${dot * 150}ms` }}
                        />
                      ))}
                    </span>
                  ) : message.role === "assistant" ? (
                    <AnswerText
                      text={message.text}
                      links={message.links ?? []}
                      error={message.error}
                      onNavigate={() => setOpen(false)}
                    />
                  ) : (
                    <span className="whitespace-pre-wrap">{message.text}</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <form
          onSubmit={submit}
          className="border-t border-border px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor="assistant-question">
              {t("label")}
            </label>
            <textarea
              id="assistant-question"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void ask(input);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder={t("placeholder")}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || input.trim() === ""}
              aria-label={t("send")}
              className="size-11 shrink-0 cursor-pointer rounded-full"
            >
              <ArrowUpIcon aria-hidden />
            </Button>
          </div>
          <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">{t("disclaimer")}</p>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function AnswerText({
  text,
  links,
  error,
  onNavigate,
}: {
  text: string;
  links: AssistantLink[];
  error?: boolean;
  onNavigate: () => void;
}) {
  const allowed = useMemo(() => new Set(links.map((link) => link.href)), [links]);
  if (error) return <p className="text-destructive">{text}</p>;
  return (
    <div className="flex flex-col gap-2 leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_ol>li]:list-decimal [&_strong]:font-semibold [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        disallowedElements={["img", "h1", "h2", "h3", "h4", "h5", "h6", "table"]}
        unwrapDisallowed
        components={{
          a: ({ href, children }) =>
            href && allowedLink(href, allowed) ? (
              <Link
                href={href}
                onClick={onNavigate}
                className="font-medium text-primary underline decoration-primary/30 underline-offset-[3px] hover:decoration-primary"
              >
                {/* A title in Hebrew must not pull the date beside it into its own direction. */}
                <bdi>{children}</bdi>
              </Link>
            ) : (
              <bdi>{children}</bdi>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
