import type { Exercise, Lang, Operator, Sheet } from "./schema";

/**
 * The answer key, computed. The model writes the numbers; the application works out what they
 * make — a parent who checks the answer key of a CP sheet must never find 7 + 5 = 13.
 */

const SYMBOLS: Record<Operator, string> = { plus: "+", minus: "−", times: "×", divide: "÷" };

export function operatorSymbol(operator: Operator): string {
  return SYMBOLS[operator];
}

export function operationResult(op: { left: number; operator: Operator; right: number }): number {
  switch (op.operator) {
    case "plus":
      return op.left + op.right;
    case "minus":
      return op.left - op.right;
    case "times":
      return op.left * op.right;
    case "divide":
      return op.right === 0 ? 0 : op.left / op.right;
  }
}

export function sequenceValues(sequence: { start: number; step: number; length: number }) {
  return Array.from(
    { length: sequence.length },
    (_, index) => sequence.start + sequence.step * index,
  );
}

export function compareSymbol(left: number, right: number): "<" | ">" | "=" {
  return left < right ? "<" : left > right ? ">" : "=";
}

/** A shuffle that gives the same order every time for the same seed — on screen and on paper. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [out[index], out[other]] = [out[other]!, out[index]!];
  }
  // Matching against an unshuffled column would be no exercise: turn it once more if needed.
  if (out.length > 1 && out.every((item, index) => item === items[index])) out.push(out.shift()!);
  return out;
}

export type AudioClip = { id: string; lang: Lang; text: string };

/** At most this many recorded voices per sheet: each one is a call, and a wait. */
export const MAX_CLIPS = 16;

/**
 * What a sheet gives to hear: a text or a poem read aloud, the words of a matching exercise,
 * the words of a dictation. The ids are what the stored `audio` map is keyed by.
 */
export function audioClips(sheet: Sheet): AudioClip[] {
  const clips: AudioClip[] = [];
  sheet.exercises.forEach((exercise: Exercise, index) => {
    const id = `ex${index + 1}`;
    if (exercise.kind === "read" && exercise.audio) {
      const title = exercise.title ? `${exercise.title}.\n\n` : "";
      clips.push({ id, lang: exercise.lang, text: `${title}${exercise.text}` });
    }
    if (exercise.kind === "match" && exercise.audio) {
      exercise.pairs.forEach((pair, word) =>
        clips.push({ id: `${id}-w${word + 1}`, lang: exercise.lang, text: pair.word }),
      );
    }
    if (exercise.kind === "dictation") {
      exercise.words.forEach((text, word) =>
        clips.push({ id: `${id}-w${word + 1}`, lang: exercise.lang, text }),
      );
    }
  });
  return clips.slice(0, MAX_CLIPS);
}

/**
 * Whether what a child typed is the expected answer: case, surrounding spaces and final
 * punctuation do not count; accents do — « tete » is not « tête » in a dictation.
 */
export function sameAnswer(typed: string, expected: string): boolean {
  const clean = (value: string) =>
    value
      .normalize("NFC")
      .trim()
      .replace(/[\s.!?,;:]+$/u, "")
      .replace(/\s+/gu, " ")
      .toLocaleLowerCase("fr");
  return clean(typed) !== "" && clean(typed) === clean(expected);
}
