import { describe, expect, it } from "vitest";

import { describeKeyValue, parseServiceAccountKey } from "@/lib/ai/credentials";
import { pcmToWav, sampleRateOf } from "@/lib/ai/wav";
import {
  audioClips,
  compareSymbol,
  operationResult,
  seededShuffle,
  sequenceValues,
} from "@/lib/practice/answers";
import { CURRICULUM, kindsFor } from "@/lib/practice/curriculum";
import { PICTOGRAMS } from "@/lib/practice/pictograms.generated";
import { homeworkPrompt, SYSTEM_PROMPT } from "@/lib/practice/prompt";
import { SAMPLE_FRENCH_SHEET, SAMPLE_MATH_SHEET } from "@/lib/practice/samples";
import {
  type Exercise,
  isBetaSheet,
  isBetaSubject,
  LEVEL_SLUGS,
  levelFromSlug,
  parseSheet,
  readStoredSheet,
  sanitizeExercise,
  sheetJsonSchema,
} from "@/lib/practice/schema";

describe("practice sheets — what the model sends is checked (ADR-0087)", () => {
  it("accepts the two sample sheets as they are", () => {
    expect(parseSheet(SAMPLE_MATH_SHEET)?.exercises).toHaveLength(5);
    expect(parseSheet(SAMPLE_FRENCH_SHEET)?.exercises).toHaveLength(5);
  });

  it("drops an exercise that does not hold together, keeps the rest", () => {
    const sheet = parseSheet({
      ...SAMPLE_MATH_SHEET,
      exercises: [
        { kind: "count", instruction: "Compte.", items: [{ pictogram: "dragon", count: 3 }] },
        { kind: "count", instruction: "Compte.", items: [{ pictogram: "apple", count: 3 }] },
        { kind: "unknown", instruction: "?" },
      ],
    });
    expect(sheet?.exercises).toEqual([
      { kind: "count", instruction: "Compte.", items: [{ pictogram: "apple", count: 3 }] },
    ]);
  });

  it("refuses a sheet with nothing usable left", () => {
    expect(parseSheet({ ...SAMPLE_MATH_SHEET, exercises: [] })).toBeNull();
    expect(parseSheet({ title: "Sans rien" })).toBeNull();
    expect(parseSheet("not json")).toBeNull();
  });

  it("cuts text to its length instead of refusing it", () => {
    const sheet = parseSheet({ ...SAMPLE_MATH_SHEET, title: `  ${"Très long titre ".repeat(10)}` });
    expect(sheet?.title.length).toBe(70);
    expect(sheet?.title.startsWith("Très")).toBe(true);
  });

  it("never asks a negative difference, nor a division that does not fall right", () => {
    const exercise = sanitizeExercise({
      kind: "operations",
      instruction: "Calcule.",
      pictogram: "none",
      operations: [
        { left: 3, operator: "minus", right: 8 },
        { left: 10, operator: "divide", right: 3 },
        { left: 12, operator: "divide", right: 0 },
        { left: 12, operator: "divide", right: 4 },
      ],
    });
    expect(exercise).toMatchObject({
      operations: [
        { left: 8, operator: "minus", right: 3 },
        { left: 12, operator: "divide", right: 4 },
      ],
    });
  });

  it("keeps a sequence readable: blanks inside it, two numbers left to see", () => {
    const exercise = sanitizeExercise({
      kind: "sequence",
      instruction: "Complète.",
      sequences: [{ start: 1, step: 1, length: 4, blanks: [0, 1, 2, 3, 3, 9] }],
    }) as Extract<Exercise, { kind: "sequence" }>;
    expect(exercise.sequences[0]!.blanks).toEqual([0, 1]);
  });

  it("drops a question whose answer points at no choice, a picture used twice", () => {
    expect(
      sanitizeExercise({
        kind: "choice",
        instruction: "Choisis.",
        lang: "fr",
        questions: [{ prompt: "?", choices: ["a", "b"], answer: 3 }],
      }),
    ).toBeNull();
    const match = sanitizeExercise({
      kind: "match",
      instruction: "Relie.",
      lang: "en",
      audio: true,
      pairs: [
        { word: "cat", pictogram: "cat" },
        { word: "kitty", pictogram: "cat" },
        { word: "dog", pictogram: "dog" },
      ],
    }) as Extract<Exercise, { kind: "match" }>;
    expect(match.pairs.map((pair) => pair.word)).toEqual(["cat", "dog"]);
  });

  it("reads a stored sheet back, its voices with it", () => {
    const stored = readStoredSheet({ ...SAMPLE_FRENCH_SHEET, audio: { ex1: "a/b/c/ex1.wav" } });
    expect(stored?.audio).toEqual({ ex1: "a/b/c/ex1.wav" });
    expect(readStoredSheet({ broken: true })).toBeNull();
  });
});

describe("practice sheets — the answer key is computed, not trusted", () => {
  it("works out each operation", () => {
    expect(operationResult({ left: 7, operator: "plus", right: 5 })).toBe(12);
    expect(operationResult({ left: 9, operator: "minus", right: 3 })).toBe(6);
    expect(operationResult({ left: 6, operator: "times", right: 7 })).toBe(42);
    expect(operationResult({ left: 56, operator: "divide", right: 8 })).toBe(7);
  });

  it("writes out a sequence and compares two numbers", () => {
    expect(sequenceValues({ start: 30, step: -5, length: 6 })).toEqual([30, 25, 20, 15, 10, 5]);
    expect([compareSymbol(12, 21), compareSymbol(40, 39), compareSymbol(15, 15)]).toEqual([
      "<",
      ">",
      "=",
    ]);
  });

  it("shuffles the same way every time, never in the original order", () => {
    const words = ["escargot", "fleur", "soleil", "nuage"];
    expect(seededShuffle(words, "sheet-1")).toEqual(seededShuffle(words, "sheet-1"));
    expect(seededShuffle(words, "sheet-1")).not.toEqual(words);
    expect([...seededShuffle(words, "sheet-1")].sort()).toEqual([...words].sort());
    expect(seededShuffle(["a", "b"], "x")).toEqual(["b", "a"]);
  });

  it("names a voice for each text or word to hear", () => {
    const sheet = parseSheet(SAMPLE_FRENCH_SHEET)!;
    expect(audioClips(sheet).map((clip) => clip.id)).toEqual([
      "ex1",
      "ex2-w1",
      "ex2-w2",
      "ex2-w3",
      "ex2-w4",
      "ex5-w1",
      "ex5-w2",
      "ex5-w3",
    ]);
    expect(audioClips(sheet)[0]!.text.startsWith("L'escargot.\n\nPetit escargot")).toBe(true);
  });
});

describe("practice sheets — what the model is given", () => {
  it("receives a response format Gemini reads", () => {
    const text = JSON.stringify(sheetJsonSchema());
    expect(text).not.toMatch(/"(\$schema|minLength|maxLength|const|pattern)"/);
    expect(text).toContain('"enum":["count"]');
  });

  it("chooses pictograms only from the drawings the application has", () => {
    for (const key of ["apple", "snail", "menorah", "star-of-david"]) {
      expect(PICTOGRAMS).toHaveProperty(key);
      expect(SYSTEM_PROMPT).toContain(`${key} (`);
    }
  });

  it("is told the level, the homework and the kind of sheet, and no one's name", () => {
    const prompt = homeworkPrompt(
      {
        title: "Les doubles",
        body: "Apprendre les doubles jusqu'à 10.",
        subject: "Mathématiques",
        levelCode: "CP",
        levelLabel: "CP",
        attachments: 2,
      },
      "harder",
    );
    expect(prompt).toContain("Niveau de la classe : CP (6 à 7 ans)");
    expect(prompt).toContain("« Les doubles »");
    expect(prompt).toContain("Les 2 pages jointes");
    expect(prompt).toContain("POUR ALLER PLUS LOIN");
  });

  it("never writes a text to learn that the homework does not give", () => {
    // Found in production: a CP poem « à réciter sans le cahier » came back as a poem the
    // model had written itself, presented as the one to learn.
    expect(SYSTEM_PROMPT).toContain("n'en écris jamais une version de ton cru");
    expect(SYSTEM_PROMPT).toContain("le texte est dans le cahier");
  });

  it("keeps the youngest classes away from dictations and sums", () => {
    expect(kindsFor("PS")).not.toContain("dictation");
    expect(kindsFor("PS")).not.toContain("operations");
    expect(kindsFor("CP")).toContain("dictation");
    expect(Object.keys(CURRICULUM)).toHaveLength(9);
  });
});

describe("practice sheets — the « bêta » warning and the addresses", () => {
  it("marks Hebrew and Jewish studies, by the subject or by the content", () => {
    for (const subject of [
      "Hébreu",
      "Kodesh",
      "Paracha de la semaine",
      "Torah",
      "Limoudé kodech",
    ]) {
      expect(isBetaSubject(subject)).toBe(true);
    }
    expect(isBetaSubject("Mathématiques")).toBe(false);
    const math = parseSheet(SAMPLE_MATH_SHEET)!;
    expect(isBetaSheet(math, "Mathématiques")).toBe(false);
    expect(isBetaSheet({ ...math, domain: "jewish_studies" }, null)).toBe(true);
  });

  it("reads the level from its French address", () => {
    expect(LEVEL_SLUGS.harder).toBe("plus-loin");
    expect(levelFromSlug("facile")).toBe("easier");
    expect(levelFromSlug("easier")).toBeNull();
  });
});

describe("practice sheets — the plumbing", () => {
  it("wraps raw speech in a WAV a browser plays", () => {
    const wav = pcmToWav(Buffer.alloc(48000), 24000);
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.length).toBe(48044);
    expect(sampleRateOf("audio/L16;codec=pcm;rate=16000")).toBe(16000);
    expect(sampleRateOf(undefined)).toBe(24000);
  });

  it("reads a service account key as downloaded or base64-encoded", () => {
    const key = JSON.stringify({
      client_email: "kesher@p.iam.gserviceaccount.com",
      private_key: "k",
    });
    expect(parseServiceAccountKey(key)?.client_email).toBe("kesher@p.iam.gserviceaccount.com");
    expect(parseServiceAccountKey(Buffer.from(key).toString("base64"))?.private_key).toBe("k");
    expect(parseServiceAccountKey("{}")).toBeNull();
    expect(parseServiceAccountKey("nonsense")).toBeNull();
  });

  it("reads the key however it was pasted, and describes it without revealing it", () => {
    const key = JSON.stringify({
      type: "service_account",
      client_email: "kesher@p.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n",
    });
    const base64 = Buffer.from(key).toString("base64");
    expect(parseServiceAccountKey(`"${base64}"`)?.client_email).toBe(
      "kesher@p.iam.gserviceaccount.com",
    );
    expect(parseServiceAccountKey(`  '${key}'  `)?.client_email).toBe(
      "kesher@p.iam.gserviceaccount.com",
    );
    const urlSafe = base64.replace(/\+/g, "-").replace(/\//g, "_");
    expect(parseServiceAccountKey(urlSafe)).not.toBeNull();
    // Real line breaks inside the private key, as some pastes deliver them.
    const pasted = key.replace(/\\n/g, "\n");
    expect(parseServiceAccountKey(pasted)?.private_key).toContain("ABC");

    expect(describeKeyValue(key)).toBe(
      "JSON (type=service_account; fields=client_email,private_key,type)",
    );
    const apiKey = "AIzaSyD-not-a-real-key-000000000000000";
    expect(describeKeyValue(apiKey)).toMatch(/^looks like an API key/);
    expect(describeKeyValue(apiKey)).not.toContain("SyD");
    expect(describeKeyValue('{"type": "service_acc')).toMatch(/does not parse/);
    const pem = "-----BEGIN PRIVATE KEY-----\\nMIIEv\\n-----END PRIVATE KEY-----\\n";
    expect(describeKeyValue(pem)).toMatch(/^looks like the private key alone/);
    expect(describeKeyValue(pem)).not.toContain("MIIEv");
    expect(describeKeyValue(base64.slice(0, 200))).toMatch(/^base64 of a JSON that does not parse/);
  });
});
