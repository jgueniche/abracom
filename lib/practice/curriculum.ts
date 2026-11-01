import type { Database } from "@/lib/supabase/database.types";

import type { ExerciseKind, PracticeLevel } from "./schema";

/**
 * What a child of each level is expected to handle, as the model is reminded of it (ADR-0087).
 *
 * A short paraphrase of the national programmes (cycle 1 for the maternelle, cycle 2 for CP to
 * CE2, cycle 3 for CM1–CM2), not a quotation of them, and not the school's own progression:
 * the homework itself, and the pages the teacher attached to it, stay the first source. This
 * only keeps a sheet from asking a PS child to read or a CP child to divide by 7.
 */

export type LevelCode = Database["public"]["Enums"]["level_code"];

type Guide = { age: string; expectations: string; kinds: readonly ExerciseKind[] };

const YOUNG: readonly ExerciseKind[] = ["count", "match", "draw", "read", "choice"];
const ALL: readonly ExerciseKind[] = [
  "count",
  "operations",
  "sequence",
  "compare",
  "match",
  "choice",
  "fill",
  "trace",
  "read",
  "dictation",
  "draw",
];

export const CURRICULUM: Record<LevelCode, Guide> = {
  TPS: {
    age: "2 à 3 ans",
    expectations:
      "Aucun écrit. Reconnaître et nommer des objets, des animaux, des couleurs ; dénombrer 1, 2, 3 ; comptines et petites histoires écoutées.",
    kinds: ["count", "match", "draw", "read"],
  },
  PS: {
    age: "3 à 4 ans",
    expectations:
      "Pas de lecture ni d'écriture de mots. Dénombrer jusqu'à 3, puis 5 ; reconnaître des formes et des couleurs ; vocabulaire du quotidien ; comptines et poésies apprises à l'oreille ; tracés libres.",
    kinds: YOUNG,
  },
  MS: {
    age: "4 à 5 ans",
    expectations:
      "Dénombrer jusqu'à 6, comparer de petites quantités ; reconnaître les lettres de son prénom, quelques lettres capitales ; syllabes à l'oral ; comptines et poésies ; graphisme (lignes, ronds, ponts).",
    kinds: YOUNG,
  },
  GS: {
    age: "5 à 6 ans",
    expectations:
      "Dénombrer et comparer jusqu'à 10, décomposer les nombres jusqu'à 10, suite des nombres jusqu'à 30 ; sons et syllabes (phonologie) ; reconnaître les lettres ; premiers mots en écriture attachée.",
    kinds: [
      "count",
      "operations",
      "sequence",
      "compare",
      "match",
      "choice",
      "trace",
      "read",
      "draw",
    ],
  },
  CP: {
    age: "6 à 7 ans",
    expectations:
      "Nombres jusqu'à 100 ; additions et soustractions (résultats jusqu'à 100), doubles et moitiés ; sens de la multiplication et du partage par de petits problèmes. Lecture : correspondance lettres-sons, syllabes, mots simples et phrases courtes déchiffrables. Écriture attachée. Petites dictées de syllabes et de mots.",
    kinds: ALL,
  },
  CE1: {
    age: "7 à 8 ans",
    expectations:
      "Nombres jusqu'à 1 000 ; additions et soustractions posées ; tables de multiplication de 2 à 5 ; fractions simples (moitié, quart). Lecture de textes courts ; nom, verbe, sujet ; le présent ; accords simples dans le groupe nominal.",
    kinds: ALL,
  },
  CE2: {
    age: "8 à 9 ans",
    expectations:
      "Nombres jusqu'à 10 000 ; multiplication posée ; divisions qui tombent juste ; tables jusqu'à 10 ; fractions simples. Lecture de textes plus longs ; présent, futur, imparfait ; accords sujet-verbe.",
    kinds: ALL,
  },
  CM1: {
    age: "9 à 10 ans",
    expectations:
      "Grands nombres jusqu'au million ; les quatre opérations, division euclidienne ; fractions et nombres décimaux simples. Lecture et compréhension de textes variés ; passé composé, imparfait, futur ; accords dans la phrase.",
    kinds: ALL,
  },
  CM2: {
    age: "10 à 11 ans",
    expectations:
      "Nombres jusqu'au milliard ; nombres décimaux ; proportionnalité simple ; problèmes à plusieurs étapes. Compréhension de textes littéraires et documentaires ; tous les temps de l'indicatif courants ; analyse de la phrase.",
    kinds: ALL,
  },
};

export const LEVEL_INTENT: Record<PracticeLevel, string> = {
  easier:
    "PLUS FACILE que le devoir : même notion, nombres plus petits, moins d'éléments, consignes plus guidées, un exemple résolu dans la consigne si utile.",
  same: "DU MÊME NIVEAU que le devoir : même notion, même difficulté, d'autres exemples.",
  harder:
    "POUR ALLER PLUS LOIN : même notion, un cran au-dessus (nombres plus grands, un petit problème, un piège bienveillant), sans sortir du programme du niveau.",
};

/** Exercises a level can do; anything else the model returned is dropped. */
export function kindsFor(level: LevelCode | null): readonly ExerciseKind[] {
  return level ? CURRICULUM[level].kinds : ALL;
}
