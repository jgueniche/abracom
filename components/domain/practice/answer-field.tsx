"use client";

import { CheckIcon, RotateCcwIcon } from "lucide-react";
import { useId, useState } from "react";

import { sameAnswer } from "@/lib/practice/answers";
import { cn } from "@/lib/utils";

/**
 * A blank the child fills on screen, and that prints as a blank (ADR-0087). The answer is
 * checked as soon as the child confirms it: a tick and « Bravo » when it is right, a soft
 * « essaie encore » when it is not — never a red cross. The check is in the page itself; on a
 * practice sheet there is nothing to cheat.
 */

type Labels = { right: string; retry: string };

export function AnswerField({
  expected,
  label,
  labels,
  numeric = false,
  width = "w-16",
  className,
}: {
  expected: string;
  /** What the field answers, for a screen reader: « 3 + 4 ». */
  label: string;
  labels: Labels;
  numeric?: boolean;
  width?: string;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "right" | "retry">("idle");
  const status = useId();

  function check() {
    if (value.trim() === "") return setState("idle");
    setState(sameAnswer(value, expected) ? "right" : "retry");
  }

  return (
    <span className={cn("relative inline-flex items-center align-middle", className)}>
      <input
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (state !== "idle") setState("idle");
        }}
        onBlur={check}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            check();
          }
        }}
        inputMode={numeric ? "numeric" : "text"}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label={label}
        aria-describedby={status}
        aria-invalid={state === "retry" ? true : undefined}
        className={cn(
          "h-11 rounded-md border-2 bg-background px-2 text-center text-lg font-medium text-foreground tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          width,
          state === "right" && "border-success bg-success/10",
          state === "retry" && "border-warning bg-warning/10",
          state === "idle" && "border-foreground/30",
          "print:border-foreground/60 print:bg-transparent",
        )}
      />
      {/* A badge on the corner of the box rather than a word beside it: a row of eight blanks
          in a number sequence must not reflow each time one is checked. */}
      <span id={status} aria-live="polite" className="no-print">
        {state === "right" && (
          <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-success text-success-foreground">
            <CheckIcon aria-hidden className="size-3.5" strokeWidth={3} />
            <span className="sr-only">{labels.right}</span>
          </span>
        )}
        {state === "retry" && (
          <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-warning text-warning-foreground">
            <RotateCcwIcon aria-hidden className="size-3" strokeWidth={3} />
            <span className="sr-only">{labels.retry}</span>
          </span>
        )}
      </span>
    </span>
  );
}

/** Choices to tap on screen, empty boxes to tick on paper. */
export function ChoiceButtons({
  choices,
  answer,
  labels,
  dir,
}: {
  choices: string[];
  answer: number;
  labels: Labels;
  dir?: "rtl" | "ltr";
}) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <ul className="flex flex-wrap gap-2" dir={dir}>
      {choices.map((choice, index) => {
        const chosen = picked === index;
        const right = chosen && index === answer;
        return (
          <li key={index}>
            <button
              type="button"
              aria-pressed={chosen}
              onClick={() => setPicked(index)}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border-2 px-3 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                !chosen && "border-foreground/20",
                right && "border-success bg-success/10",
                chosen && !right && "border-warning bg-warning/10",
                "print:border-0 print:px-0",
              )}
            >
              <span
                aria-hidden
                className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm border-2 border-foreground/40"
              >
                {right && <CheckIcon className="size-3 text-success print:hidden" />}
              </span>
              {choice}
              {chosen && <span className="sr-only">{right ? labels.right : labels.retry}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** « < », « > » or « = » between two numbers: three buttons on screen, a circle on paper. */
export function SymbolButtons({
  expected,
  label,
  labels,
}: {
  expected: "<" | ">" | "=";
  label: string;
  labels: Labels;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const right = picked === expected;
  return (
    <span className="inline-flex items-center">
      <span role="group" aria-label={label} className="no-print inline-flex gap-1">
        {(["<", ">", "="] as const).map((symbol) => (
          <button
            key={symbol}
            type="button"
            aria-pressed={picked === symbol}
            onClick={() => setPicked(symbol)}
            className={cn(
              "inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-2 text-lg font-semibold transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              picked !== symbol && "border-foreground/20",
              picked === symbol && right && "border-success bg-success/10",
              picked === symbol && !right && "border-warning bg-warning/10",
            )}
          >
            {symbol}
          </button>
        ))}
      </span>
      <span
        aria-hidden
        className="hidden size-9 rounded-full border-2 border-foreground/60 print:inline-block"
      />
      <span aria-live="polite" className="sr-only">
        {picked ? (right ? labels.right : labels.retry) : ""}
      </span>
    </span>
  );
}
