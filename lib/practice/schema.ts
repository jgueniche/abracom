import { z } from "zod";

import { PICTOGRAMS } from "./pictograms.generated";

/**
 * What a practice sheet is made of (ADR-0087).
 *
 * The model never lays a sheet out: it fills these typed exercises, and the application draws
 * them. That is what keeps a sheet as clean as a publisher's workbook from one homework to the
 * next, and it is what makes the answer key trustworthy — every arithmetic answer is computed
 * from the numbers (`answers.ts`), never taken from the model.
 *
 * The same schema is sent to the model as its response format (`sheetJsonSchema`) and checked
 * on what comes back (`parseSheet`). Text is trimmed and cut to its length rather than
 * rejected, and an exercise that does not hold together is dropped rather than failing the
 * whole sheet: a family that asked for a sheet gets the five good exercises out of six.
 */

export const PRACTICE_LEVELS = ["easier", "same", "harder"] as const;
export type PracticeLevel = (typeof PRACTICE_LEVELS)[number];

/** The French words the addresses use: `/devoirs/<id>/entrainement/plus-loin`. */
export const LEVEL_SLUGS: Record<PracticeLevel, string> = {
  easier: "facile",
  same: "pareil",
  harder: "plus-loin",
};

export function levelFromSlug(slug: string): PracticeLevel | null {
  const found = PRACTICE_LEVELS.find((level) => LEVEL_SLUGS[level] === slug);
  return found ?? null;
}

export type PictogramKey = keyof typeof PICTOGRAMS;
export const PICTOGRAM_KEYS = Object.keys(PICTOGRAMS) as [PictogramKey, ...PictogramKey[]];
export const NO_PICTOGRAM = "none";

export const LANGS = ["fr", "en", "he"] as const;
export type Lang = (typeof LANGS)[number];

export const DOMAINS = [
  "french",
  "math",
  "english",
  "hebrew",
  "jewish_studies",
  "discovery",
  "other",
] as const;
export type Domain = (typeof DOMAINS)[number];

/** Domains shown with the « bêta » warning, as the porteur decided. */
export const BETA_DOMAINS: readonly Domain[] = ["hebrew", "jewish_studies"];

/** A string trimmed, required, and cut to its length rather than refused. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.slice(0, max));
/** The same, where an empty string means « none ». */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .transform((value) => value.slice(0, max));

const instruction = text(160).describe(
  "Consigne courte, adressée à l'enfant au tutoiement, dans la langue de l'exercice.",
);
const lang = z.enum(LANGS).describe("Langue du contenu de l'exercice.");
const pictogram = z.enum(PICTOGRAM_KEYS);

const countExercise = z.object({
  kind: z.enum(["count"]),
  instruction,
  items: z
    .array(z.object({ pictogram, count: z.int().min(1).max(20) }))
    .min(1)
    .max(6)
    .describe("Chaque ligne : un pictogramme répété `count` fois, l'enfant écrit le nombre."),
});

export const OPERATORS = ["plus", "minus", "times", "divide"] as const;
export type Operator = (typeof OPERATORS)[number];

const operationsExercise = z.object({
  kind: z.enum(["operations"]),
  instruction,
  operations: z
    .array(
      z.object({
        left: z.int().min(0).max(100000),
        operator: z.enum(OPERATORS),
        right: z.int().min(0).max(100000),
      }),
    )
    .min(1)
    .max(12)
    .describe("Les calculs. Ne donne jamais le résultat : l'application le calcule."),
  pictogram: z
    .enum([...PICTOGRAM_KEYS, NO_PICTOGRAM])
    .describe(
      "Pour des additions ou soustractions dont les nombres ne dépassent pas 10 : un pictogramme pour les dessiner. Sinon « none ».",
    ),
});

const sequenceExercise = z.object({
  kind: z.enum(["sequence"]),
  instruction,
  sequences: z
    .array(
      z.object({
        start: z.int().min(0).max(100000),
        step: z.int().min(-1000).max(10000),
        length: z.int().min(4).max(10),
        blanks: z
          .array(z.int().min(0).max(9))
          .min(1)
          .max(6)
          .describe("Positions (à partir de 0) des cases que l'enfant complète."),
      }),
    )
    .min(1)
    .max(4),
});

const compareExercise = z.object({
  kind: z.enum(["compare"]),
  instruction,
  pairs: z
    .array(z.object({ left: z.int().min(0).max(1000000), right: z.int().min(0).max(1000000) }))
    .min(1)
    .max(10)
    .describe("L'enfant écrit <, > ou = entre les deux nombres."),
});

const matchExercise = z.object({
  kind: z.enum(["match"]),
  instruction,
  lang,
  pairs: z
    .array(z.object({ word: text(40), pictogram }))
    .min(2)
    .max(8)
    .describe("Relier chaque mot à son image. Un mot que le pictogramme montre sans ambiguïté."),
  audio: z.boolean().describe("Vrai pour faire entendre la prononciation de chaque mot."),
});

const choiceExercise = z.object({
  kind: z.enum(["choice"]),
  instruction,
  lang,
  questions: z
    .array(
      z.object({
        prompt: text(200),
        choices: z.array(text(80)).min(2).max(4),
        answer: z.int().min(0).max(3).describe("Index de la bonne réponse dans `choices`."),
      }),
    )
    .min(1)
    .max(6),
});

const fillExercise = z.object({
  kind: z.enum(["fill"]),
  instruction,
  lang,
  sentences: z
    .array(
      z.object({
        before: optionalText(160),
        answer: text(40),
        after: optionalText(160),
        hint: optionalText(40).describe("Aide entre parenthèses (ex. l'infinitif), ou vide."),
      }),
    )
    .min(1)
    .max(8),
});

const traceExercise = z.object({
  kind: z.enum(["trace"]),
  instruction,
  lang,
  lines: z
    .array(text(40))
    .min(1)
    .max(6)
    .describe("Lettres, syllabes ou mots que l'enfant recopie en écriture attachée."),
});

const readExercise = z.object({
  kind: z.enum(["read"]),
  instruction,
  lang,
  form: z.enum(["poem", "prose"]),
  title: optionalText(80),
  text: text(1500).describe("Le texte ou la poésie. Pour une poésie, un vers par ligne."),
  audio: z.boolean().describe("Vrai pour faire entendre le texte lu à voix haute."),
  questions: z
    .array(z.object({ prompt: text(200), answer: optionalText(200) }))
    .max(5)
    .describe("Questions de compréhension, avec la réponse attendue pour le corrigé."),
});

const dictationExercise = z.object({
  kind: z.enum(["dictation"]),
  instruction,
  lang,
  words: z
    .array(text(40))
    .min(2)
    .max(10)
    .describe("Mots dictés : chacun est lu à voix haute, l'enfant l'écrit."),
});

const drawExercise = z.object({
  kind: z.enum(["draw"]),
  instruction,
});

export const exerciseSchema = z.discriminatedUnion("kind", [
  countExercise,
  operationsExercise,
  sequenceExercise,
  compareExercise,
  matchExercise,
  choiceExercise,
  fillExercise,
  traceExercise,
  readExercise,
  dictationExercise,
  drawExercise,
]);
export type Exercise = z.output<typeof exerciseSchema>;
export type ExerciseKind = Exercise["kind"];

export const sheetSchema = z.object({
  title: text(70).describe("Titre ludique de la feuille, sans le nom d'un enfant."),
  intro: text(220).describe("Une phrase qui met l'enfant en route, comme une petite histoire."),
  domain: z.enum(DOMAINS),
  illustration: text(400).describe(
    "In English: one scene for the header illustration — a flat children's book picture, no text, no letters, no numbers, no real people.",
  ),
  parentTip: text(400).describe("Un conseil court au parent pour accompagner l'enfant."),
  exercises: z.array(exerciseSchema).min(1).max(6),
});
export type Sheet = z.output<typeof sheetSchema>;

/** What is stored: the sheet, plus where each recorded voice lives (clip id → storage path). */
export type StoredSheet = Sheet & { audio: Record<string, string> };

const storedSheetSchema = sheetSchema.extend({
  audio: z.record(z.string(), z.string()).default({}),
});

/** Reads a stored sheet back; null if it does not hold together any more. */
export function readStoredSheet(value: unknown): StoredSheet | null {
  const parsed = storedSheetSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Checks what the model sent. The frame (title, intro…) must hold; each exercise is checked on
 * its own and dropped if it does not, then made consistent (`sanitizeExercise`). Null when
 * nothing usable is left.
 */
export function parseSheet(raw: unknown): Sheet | null {
  const frame = sheetSchema.omit({ exercises: true }).safeParse(raw);
  if (!frame.success) return null;
  const list = (raw as { exercises?: unknown }).exercises;
  if (!Array.isArray(list)) return null;
  const exercises = list
    .slice(0, 6)
    .flatMap((item) => {
      const parsed = exerciseSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    })
    .flatMap((exercise) => {
      const clean = sanitizeExercise(exercise);
      return clean ? [clean] : [];
    });
  if (exercises.length === 0) return null;
  return { ...frame.data, exercises };
}

/**
 * Makes an exercise consistent instead of trusting the model with it: no negative difference,
 * no division that does not fall right, no blank outside its sequence, a sequence that shows
 * at least two of its numbers, and a multiple-choice answer that points at a choice.
 */
export function sanitizeExercise(exercise: Exercise): Exercise | null {
  switch (exercise.kind) {
    case "operations": {
      const operations = exercise.operations.flatMap((op) => {
        if (op.operator === "minus" && op.right > op.left)
          return [{ ...op, left: op.right, right: op.left }];
        if (op.operator === "divide" && (op.right === 0 || op.left % op.right !== 0)) return [];
        return [op];
      });
      return operations.length > 0 ? { ...exercise, operations } : null;
    }
    case "sequence": {
      const sequences = exercise.sequences.flatMap((sequence) => {
        const last = sequence.start + sequence.step * (sequence.length - 1);
        if (last < 0) return [];
        const blanks = [...new Set(sequence.blanks)]
          .filter((index) => index < sequence.length)
          .sort((a, b) => a - b);
        while (blanks.length > sequence.length - 2) blanks.pop();
        return blanks.length > 0 ? [{ ...sequence, blanks }] : [];
      });
      return sequences.length > 0 ? { ...exercise, sequences } : null;
    }
    case "choice": {
      const questions = exercise.questions.filter(
        (question) => question.answer < question.choices.length,
      );
      return questions.length > 0 ? { ...exercise, questions } : null;
    }
    case "match": {
      const seen = new Set<string>();
      const pairs = exercise.pairs.filter((pair) => {
        if (seen.has(pair.pictogram)) return false;
        seen.add(pair.pictogram);
        return true;
      });
      return pairs.length >= 2 ? { ...exercise, pairs } : null;
    }
    default:
      return exercise;
  }
}

/** Whether a sheet carries the « bêta » warning: Hebrew or Jewish studies (ADR-0087). */
export function isBetaSheet(sheet: Sheet, subject: string | null): boolean {
  return (
    BETA_DOMAINS.includes(sheet.domain) ||
    sheet.exercises.some((exercise) => "lang" in exercise && exercise.lang === "he") ||
    isBetaSubject(subject)
  );
}

const BETA_SUBJECT =
  /h[ée]breu|kodesh|kod[eè]ch|torah|thora|paracha|parasha|limoud|tefil|t[ée]fila|ivrit/i;

/** Hebrew or Jewish studies, read from the subject the teacher typed. */
export function isBetaSubject(subject: string | null): boolean {
  return subject !== null && BETA_SUBJECT.test(subject);
}

/**
 * The JSON schema given to the model as its response format. Gemini reads a subset of JSON
 * Schema; what it does not read (lengths, `$schema`) is taken out, and `parseSheet` enforces
 * it on the way back.
 */
export function sheetJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(sheetSchema, { io: "input" });
  return stripUnsupported(schema) as Record<string, unknown>;
}

const DROPPED_KEYS = new Set(["$schema", "minLength", "maxLength", "pattern", "format"]);

function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (DROPPED_KEYS.has(key)) continue;
    if (key === "const") {
      out.enum = [value];
      continue;
    }
    // Integers bounded by Number.MAX_SAFE_INTEGER say nothing; leave them out.
    if ((key === "minimum" || key === "maximum") && Math.abs(Number(value)) > 1e12) continue;
    out[key] = stripUnsupported(value);
  }
  return out;
}
