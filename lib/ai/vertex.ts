import "server-only";

import {
  type GenerateContentConfig,
  type GenerateContentResponse,
  GoogleGenAI,
  type Part,
  ThinkingLevel,
} from "@google/genai";

import type { Lang } from "@/lib/practice/schema";

import { type PracticeProvider, ProviderError, type SheetRequest } from "./types";
import { pcmToWav, sampleRateOf } from "./wav";

/**
 * Google Cloud — Vertex AI (the « Gemini Enterprise Agent Platform »), EU multi-region.
 *
 * `location: "eu"` sends every call to `aiplatform.eu.rep.googleapis.com`, where Google commits
 * to process inside the European Union (data-residency page, 2026-10-30). The `global`
 * endpoint carries no such commitment — `vertexProvider` refuses it, so that a misconfigured
 * deployment fails loudly instead of quietly sending homework abroad. Three models, all three
 * listed at `eu` on that date: `gemini-3.8-flash` writes the exercises,
 * `gemini-3.1-flash-image` draws the picture, `gemini-3.8-flash-tts` reads aloud.
 *
 * What is sent: the homework (title, instructions, subject, level) and the pages the teacher
 * attached. No name of a child, no family, no account — the child's first name is written on
 * the sheet by the application, after the model has answered.
 */

export type VertexConfig = {
  project: string;
  location: string;
  credentials: { client_email: string; private_key: string };
  textModel: string;
  imageModel: string;
  ttsModel: string;
  voice: string;
};

const SPEECH_LOCALE: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", he: "he-IL" };
const LABELS = { app: "kesher", feature: "practice" };

export function vertexProvider(config: VertexConfig): PracticeProvider {
  if (config.location === "global") {
    throw new Error("GOOGLE_CLOUD_LOCATION=global : aucune garantie de traitement dans l'UE.");
  }
  const ai = new GoogleGenAI({
    vertexai: true,
    project: config.project,
    location: config.location,
    googleAuthOptions: {
      credentials: config.credentials,
      projectId: config.project,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    },
  });

  return {
    name: "vertex",
    textModel: config.textModel,

    async writeSheet(request: SheetRequest) {
      const parts: Part[] = request.parts.map((part) =>
        "text" in part
          ? { text: part.text }
          : {
              inlineData: { mimeType: part.file.mimeType, data: part.file.data.toString("base64") },
            },
      );
      // From the fullest request to the plainest. Vertex answers a parameter it does not take with
      // a bare 400 « invalid argument » that names nothing: each refusal is logged with what was
      // sent, and the next form is tried. The answer is checked by `parseSheet` in every case.
      const base = { responseMimeType: "application/json", httpOptions: { timeout: 90_000 } };
      const schemaInPrompt = `${request.system}\n\nRéponds uniquement par un objet JSON conforme à ce schéma JSON :\n${JSON.stringify(request.schema)}`;
      // In production (2026-11-01) Vertex refused `responseJsonSchema` as `sheetJsonSchema()`
      // writes it, with or without the rest, and took the schema written in the prompt. The
      // first form tries the schema in its plainest dialect (`anyOf`, no `additionalProperties`):
      // accepted, it brings back structured output; refused, it costs a second.
      const attempts: Array<{ name: string; config: GenerateContentConfig }> = [
        {
          name: "plain-schema+thinking+labels",
          config: {
            ...base,
            systemInstruction: request.system,
            responseJsonSchema: plainSchema(request.schema),
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            labels: LABELS,
          },
        },
        {
          name: "schema-in-prompt+thinking+labels",
          config: {
            ...base,
            systemInstruction: schemaInPrompt,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            labels: LABELS,
          },
        },
        { name: "schema-in-prompt", config: { ...base, systemInstruction: schemaInPrompt } },
      ];
      let response: GenerateContentResponse | null = null;
      for (const attempt of attempts) {
        try {
          response = await ai.models.generateContent({
            model: config.textModel,
            contents: [{ role: "user", parts }],
            config: attempt.config,
          });
          console.info(`[practice] writeSheet: ${config.textModel} answered (${attempt.name})`);
          break;
        } catch (error) {
          const message = (error as Error).message ?? String(error);
          if ((error as { status?: unknown }).status === 400) {
            console.warn(`[practice] writeSheet: ${attempt.name} refused: ${message}`);
            continue;
          }
          throw new ProviderError(
            /timeout|aborted/i.test(message) ? "timeout" : "provider_error",
            message,
          );
        }
      }
      if (!response) throw new ProviderError("provider_error", "every request form was refused");
      if (response.promptFeedback?.blockReason) {
        throw new ProviderError("blocked", String(response.promptFeedback.blockReason));
      }
      const text = response.text;
      if (!text) throw new ProviderError("empty", "no text in the response");
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new ProviderError("empty", "the response is not JSON");
      }
    },

    async illustrate(prompt: string) {
      try {
        const response = await call(() =>
          ai.models.generateContent({
            model: config.imageModel,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              responseModalities: ["IMAGE"],
              imageConfig: { aspectRatio: "16:9" },
              labels: LABELS,
              httpOptions: { timeout: 60_000 },
            },
          }),
        );
        const data = firstInline(response.candidates?.[0]?.content?.parts, "image/");
        return data ? Buffer.from(data.data, "base64") : null;
      } catch (error) {
        console.warn("[practice] illustration:", (error as Error).message);
        return null;
      }
    },

    async speak(text: string, lang: Lang, style: "text" | "word") {
      // Gemini-TTS takes its direction in the prompt itself, before a colon.
      const direction =
        style === "word"
          ? "Say this word once, slowly and very clearly, for a young child learning it"
          : "Read this aloud for a young child: slowly, warmly and clearly, with the natural rhythm of a poem or a story";
      try {
        const response = await call(() =>
          ai.models.generateContent({
            model: config.ttsModel,
            contents: [{ role: "user", parts: [{ text: `${direction}:\n${text}` }] }],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                languageCode: SPEECH_LOCALE[lang],
                voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voice } },
              },
              labels: LABELS,
              httpOptions: { timeout: 45_000 },
            },
          }),
        );
        const data = firstInline(response.candidates?.[0]?.content?.parts, "audio/");
        if (!data) return null;
        return pcmToWav(Buffer.from(data.data, "base64"), sampleRateOf(data.mimeType));
      } catch (error) {
        console.warn("[practice] speech:", (error as Error).message);
        return null;
      }
    },
  };
}

function firstInline(parts: Part[] | undefined, prefix: string) {
  for (const part of parts ?? []) {
    const inline = part.inlineData;
    if (inline?.data && (inline.mimeType ?? "").startsWith(prefix)) {
      return { data: inline.data, mimeType: inline.mimeType };
    }
  }
  return null;
}

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    const message = (error as Error).message ?? String(error);
    throw new ProviderError(
      /timeout|aborted/i.test(message) ? "timeout" : "provider_error",
      message,
    );
  }
}

/** The schema in the dialect Vertex documents most plainly: `anyOf`, no `additionalProperties`. */
function plainSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(plainSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "additionalProperties") continue;
    out[key === "oneOf" ? "anyOf" : key] = plainSchema(value);
  }
  return out;
}
