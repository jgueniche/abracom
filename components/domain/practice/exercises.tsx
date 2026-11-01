import { Fragment, type ReactNode } from "react";

import {
  compareSymbol,
  operationResult,
  operatorSymbol,
  seededShuffle,
  sequenceValues,
} from "@/lib/practice/answers";
import { type Exercise, type Lang, NO_PICTOGRAM, type PictogramKey } from "@/lib/practice/schema";
import { cn } from "@/lib/utils";

import { AnswerField, ChoiceButtons, SymbolButtons } from "./answer-field";
import { Pictogram, pictogramName } from "./pictogram";
import { PlayButton } from "./play-button";

/**
 * The exercises of a practice sheet, drawn by the application from what the model filled in
 * (ADR-0087). Each kind has one layout, the same from one sheet to the next — the way a
 * workbook keeps its conventions — and works twice: on screen, the blanks are fields the
 * child fills and that check themselves; on paper, they are boxes and lines for a pencil.
 */

export type ExerciseLabels = {
  exercise: (number: number) => string;
  listen: string;
  listenWord: (word: string) => string;
  stop: string;
  scan: string;
  questions: string;
  word: (number: number) => string;
  right: string;
  retry: string;
};

export type ExerciseContext = {
  /** `ex3` → signed URL of its voice; `ex3-w2` for a word. */
  audio: Record<string, string>;
  /** `ex3` → QR code (SVG) leading back to the exercise, for paper. */
  qr: Record<string, string>;
  seed: string;
  locale: string;
  labels: ExerciseLabels;
};

const LANG_PROPS: Record<Lang, { lang: string; dir: "ltr" | "rtl"; className?: string }> = {
  fr: { lang: "fr", dir: "ltr" },
  en: { lang: "en", dir: "ltr" },
  he: { lang: "he", dir: "rtl", className: "font-hebrew" },
};

export function ExerciseBlock({
  exercise,
  index,
  context,
}: {
  exercise: Exercise;
  index: number;
  context: ExerciseContext;
}) {
  const id = `ex${index + 1}`;
  const voice = context.audio[id];
  const qr = context.qr[id];
  return (
    <section id={`exercice-${index + 1}`} className="mb-9 scroll-mt-24 break-inside-avoid">
      <div className="mb-3 flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground tabular-nums print:border print:border-foreground print:bg-transparent print:text-foreground"
        >
          {index + 1}
        </span>
        <h2 className="flex-1 pt-0.5 font-sans text-[0.9375rem] leading-snug font-semibold text-pretty">
          <span className="sr-only">{context.labels.exercise(index + 1)} — </span>
          {exercise.instruction}
        </h2>
        {voice && (
          <PlayButton src={voice} label={context.labels.listen} stopLabel={context.labels.stop} />
        )}
        {qr && <QrCode svg={qr} label={context.labels.scan} />}
      </div>
      <div className="pl-10 max-sm:pl-0">
        <ExerciseBody exercise={exercise} id={id} context={context} />
      </div>
    </section>
  );
}

function ExerciseBody({
  exercise,
  id,
  context,
}: {
  exercise: Exercise;
  id: string;
  context: ExerciseContext;
}) {
  const feedback = { right: context.labels.right, retry: context.labels.retry };
  switch (exercise.kind) {
    case "count":
      return (
        <ul className="space-y-3">
          {exercise.items.map((item, row) => (
            <li key={row} className="flex items-center gap-4">
              <PictogramRow name={item.pictogram} count={item.count} />
              <AnswerField
                expected={String(item.count)}
                label={`${pictogramName(item.pictogram, context.locale)} : ?`}
                labels={feedback}
                numeric
              />
            </li>
          ))}
        </ul>
      );

    case "operations": {
      const picture = exercise.pictogram === NO_PICTOGRAM ? null : exercise.pictogram;
      const drawsAny =
        picture !== null &&
        exercise.operations.some(
          (op) =>
            (op.operator === "plus" || op.operator === "minus") && op.left <= 10 && op.right <= 10,
        );
      return (
        <ul className={cn("grid gap-x-8 gap-y-5", !drawsAny && "sm:grid-cols-2")}>
          {exercise.operations.map((op, row) => {
            const drawn =
              picture &&
              op.operator !== "times" &&
              op.operator !== "divide" &&
              op.left <= 10 &&
              op.right <= 10;
            const text = `${op.left} ${operatorSymbol(op.operator)} ${op.right}`;
            return (
              <li key={row} className="flex flex-col gap-1.5">
                {drawn && (
                  <span aria-hidden className="flex flex-wrap items-center gap-2">
                    <PictogramRow name={picture} count={op.left} small grow={false} />
                    <span className="text-lg font-semibold">{operatorSymbol(op.operator)}</span>
                    <PictogramRow name={picture} count={op.right} small grow={false} />
                  </span>
                )}
                <span className="flex items-center gap-2 text-xl tabular-nums">
                  <span>{text} =</span>
                  <AnswerField
                    expected={String(operationResult(op))}
                    label={`${text} =`}
                    labels={feedback}
                    numeric
                  />
                </span>
              </li>
            );
          })}
        </ul>
      );
    }

    case "sequence":
      return (
        <ul className="space-y-3">
          {exercise.sequences.map((sequence, row) => {
            const values = sequenceValues(sequence);
            return (
              <li key={row} className="flex flex-wrap items-center gap-2 text-lg tabular-nums">
                {values.map((value, position) =>
                  sequence.blanks.includes(position) ? (
                    <AnswerField
                      key={position}
                      expected={String(value)}
                      label={`${position + 1}`}
                      labels={feedback}
                      numeric
                      width="w-14"
                    />
                  ) : (
                    <span
                      key={position}
                      className="inline-flex h-11 min-w-11 items-center justify-center rounded-md bg-muted px-2 font-medium print:border print:border-foreground/30 print:bg-transparent"
                    >
                      {value}
                    </span>
                  ),
                )}
              </li>
            );
          })}
        </ul>
      );

    case "compare":
      return (
        <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {exercise.pairs.map((pair, row) => (
            <li key={row} className="flex items-center gap-3 text-xl tabular-nums">
              <span className="w-20 text-right">{pair.left}</span>
              <SymbolButtons
                expected={compareSymbol(pair.left, pair.right)}
                label={`${pair.left} ? ${pair.right}`}
                labels={feedback}
              />
              <span className="w-20">{pair.right}</span>
            </li>
          ))}
        </ul>
      );

    case "match": {
      const lang = LANG_PROPS[exercise.lang];
      const pictures = seededShuffle(
        exercise.pairs.map((pair) => pair.pictogram),
        `${context.seed}-${id}`,
      );
      return (
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-x-6 gap-y-2 sm:max-w-md">
          {exercise.pairs.map((pair, row) => (
            <Fragment key={row}>
              {/* The cell keeps the page's direction, so that a Hebrew word sits against the
                  dots like a French one; only the word itself is right-to-left. */}
              <span className="flex min-h-12 items-center justify-end gap-1 text-lg">
                {context.audio[`${id}-w${row + 1}`] && (
                  <PlayButton
                    src={context.audio[`${id}-w${row + 1}`]!}
                    label={context.labels.listenWord(pair.word)}
                    stopLabel={context.labels.stop}
                    compact
                  />
                )}
                <span lang={lang.lang} dir={lang.dir} className={lang.className}>
                  {pair.word}
                </span>
              </span>
              <span aria-hidden className="flex items-center gap-12">
                <span className="size-2.5 rounded-full bg-foreground/60" />
                <span className="size-2.5 rounded-full bg-foreground/60" />
              </span>
              <span className="flex min-h-12 items-center">
                <Pictogram
                  name={pictures[row]!}
                  label={pictogramName(pictures[row]!, context.locale)}
                  className="size-10"
                />
              </span>
            </Fragment>
          ))}
        </div>
      );
    }

    case "choice": {
      const lang = LANG_PROPS[exercise.lang];
      return (
        <ol className="space-y-5">
          {exercise.questions.map((question, row) => (
            <li key={row} lang={lang.lang} className={lang.className}>
              <p dir={lang.dir} className="mb-2 text-[0.9375rem]">
                {question.prompt}
              </p>
              <ChoiceButtons
                choices={question.choices}
                answer={question.answer}
                labels={feedback}
                dir={lang.dir}
              />
            </li>
          ))}
        </ol>
      );
    }

    case "fill": {
      const lang = LANG_PROPS[exercise.lang];
      return (
        <ol className="space-y-4">
          {exercise.sentences.map((sentence, row) => (
            <li
              key={row}
              lang={lang.lang}
              dir={lang.dir}
              className={cn("text-lg leading-[2.75rem]", lang.className)}
            >
              {sentence.before}{" "}
              <AnswerField
                expected={sentence.answer}
                label={`${sentence.before} … ${sentence.after}`}
                labels={feedback}
                width="w-36"
              />
              {sentence.hint && (
                <span className="text-sm text-muted-foreground"> ({sentence.hint})</span>
              )}{" "}
              {sentence.after}
            </li>
          ))}
        </ol>
      );
    }

    case "trace": {
      const hebrewScript = exercise.lang === "he";
      const lang = LANG_PROPS[exercise.lang];
      return (
        <ul className="space-y-4">
          {exercise.lines.map((line, row) => (
            <li key={row} lang={lang.lang} dir={lang.dir} className="h-24 rounded-sm seyes">
              <span
                className={cn(
                  "block px-2 pt-[0.6rem] text-[2rem] leading-[4rem] text-foreground/45 print:text-foreground/35",
                  hebrewScript ? "font-hebrew" : "font-cursive",
                )}
              >
                {line}
              </span>
            </li>
          ))}
        </ul>
      );
    }

    case "read": {
      const lang = LANG_PROPS[exercise.lang];
      return (
        <div>
          <article
            lang={lang.lang}
            dir={lang.dir}
            className={cn(
              "mb-5 rounded-lg bg-muted/60 px-5 py-4 print:bg-transparent print:px-0",
              lang.className,
            )}
          >
            {exercise.title && <p className="mb-2 font-heading text-xl">{exercise.title}</p>}
            <p
              className={cn(
                "whitespace-pre-line",
                exercise.form === "poem"
                  ? "font-heading text-lg leading-relaxed"
                  : "text-base leading-7",
              )}
            >
              {exercise.text}
            </p>
          </article>
          {exercise.questions.length > 0 && (
            <ol className="space-y-4">
              {exercise.questions.map((question, row) => (
                <li key={row} lang={lang.lang} dir={lang.dir} className={lang.className}>
                  <p className="mb-1 text-[0.9375rem]">{question.prompt}</p>
                  <WritingLines count={1} />
                </li>
              ))}
            </ol>
          )}
        </div>
      );
    }

    case "dictation": {
      const lang = LANG_PROPS[exercise.lang];
      return (
        <ol className="space-y-3">
          {exercise.words.map((word, row) => {
            const voice = context.audio[`${id}-w${row + 1}`];
            return (
              <li key={row} className="flex items-end gap-3" lang={lang.lang} dir={lang.dir}>
                <span className="w-16 shrink-0 pb-2 text-sm text-muted-foreground">
                  {context.labels.word(row + 1)}
                </span>
                {voice && (
                  <PlayButton
                    src={voice}
                    label={context.labels.listenWord(context.labels.word(row + 1))}
                    stopLabel={context.labels.stop}
                    compact
                  />
                )}
                <span className="h-12 flex-1 rounded-sm seyes" />
              </li>
            );
          })}
        </ol>
      );
    }

    case "draw":
      return (
        <div
          aria-hidden
          className="h-56 rounded-lg border-2 border-dashed border-foreground/25 print:h-72"
        />
      );
  }
}

/** Pictures in groups of five, the way a child is taught to count them. */
function PictogramRow({
  name,
  count,
  small = false,
  grow = true,
}: {
  name: PictogramKey;
  count: number;
  small?: boolean;
  grow?: boolean;
}) {
  const groups = Array.from({ length: Math.ceil(count / 5) }, (_, group) =>
    Math.min(5, count - group * 5),
  );
  return (
    <span
      aria-hidden
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", grow && "flex-1")}
    >
      {groups.map((size, group) => (
        <span key={group} className="flex gap-0.5">
          {Array.from({ length: size }, (_, item) => (
            <Pictogram key={item} name={name} className={small ? "size-6" : "size-8"} />
          ))}
        </span>
      ))}
    </span>
  );
}

function WritingLines({ count }: { count: number }) {
  return (
    <span aria-hidden className="block">
      {Array.from({ length: count }, (_, line) => (
        <span key={line} className="block h-9 border-b border-dashed border-foreground/35" />
      ))}
    </span>
  );
}

function QrCode({ svg, label }: { svg: string; label: string }) {
  return (
    <span className="hidden shrink-0 flex-col items-center gap-0.5 print:flex">
      <span className="block size-16" dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="text-[0.625rem] text-muted-foreground">{label}</span>
    </span>
  );
}

/** The answer key: one line per exercise, the computed answers. */
export function AnswerKeyList({
  exercises,
  locale,
  labels,
}: {
  exercises: Exercise[];
  locale: string;
  labels: Pick<ExerciseLabels, "exercise">;
}): ReactNode {
  return (
    <ol className="space-y-3 text-sm">
      {exercises.map((exercise, index) => (
        <li key={index} className="flex gap-3">
          <span className="w-24 shrink-0 font-semibold">{labels.exercise(index + 1)}</span>
          <span className="flex-1">
            {/* Each answer isolated: a Hebrew word must not turn the line around. */}
            {keyItems(exercise, locale).map((item, position) => (
              <Fragment key={position}>
                {position > 0 && " · "}
                <bdi>{item}</bdi>
              </Fragment>
            ))}
          </span>
        </li>
      ))}
    </ol>
  );
}

function keyItems(exercise: Exercise, locale: string): string[] {
  switch (exercise.kind) {
    case "count":
      return exercise.items.map(
        (item) => `${pictogramName(item.pictogram, locale)} : ${item.count}`,
      );
    case "operations":
      return exercise.operations.map(
        (op) => `${op.left} ${operatorSymbol(op.operator)} ${op.right} = ${operationResult(op)}`,
      );
    case "sequence":
      return exercise.sequences.map((sequence) => sequenceValues(sequence).join(", "));
    case "compare":
      return exercise.pairs.map(
        (pair) => `${pair.left} ${compareSymbol(pair.left, pair.right)} ${pair.right}`,
      );
    case "match":
      return exercise.pairs.map(
        (pair) => `${pictogramName(pair.pictogram, locale)} : ${pair.word}`,
      );
    case "choice":
      return exercise.questions.map((question) => question.choices[question.answer] ?? "");
    case "fill":
      return exercise.sentences.map((sentence) => sentence.answer);
    case "read": {
      const answers = exercise.questions.map((question) => question.answer).filter(Boolean);
      return answers.length > 0 ? answers : ["—"];
    }
    case "dictation":
      return exercise.words;
    case "trace":
    case "draw":
      return ["—"];
  }
}
