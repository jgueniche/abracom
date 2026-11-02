import "server-only";

import { GoogleGenAI, ThinkingLevel } from "@google/genai";

import { planSchema, type Plan } from "@/lib/assistant/plan";
import { getServerEnv } from "@/lib/env.server";

import { assistantMode } from "./config";
import { parseServiceAccountKey } from "./credentials";

/**
 * The assistant's model (ADR-0088): the same Google Cloud project and EU multi-region as
 * « S'entraîner » — the porteur's choice, one sub-processor — or a fake that calls nobody.
 *
 * Two calls. `plan` asks which tools a question needs and expects JSON (the schema written in
 * the prompt: Vertex refused `responseJsonSchema` in production, ADR-0087); it answers null
 * rather than throw, and the caller falls back to a plan made from the words of the question.
 * `answer` streams the reply as it is written.
 */
export interface AssistantModel {
  readonly name: "vertex" | "fake";
  plan(system: string, prompt: string): Promise<Plan | null>;
  answer(system: string, prompt: string): AsyncIterable<string>;
}

const LABELS = { app: "kesher", feature: "assistant" };

export function getAssistantModel(): AssistantModel | null {
  const mode = assistantMode();
  if (mode === "fake") return fakeAssistant();
  if (mode !== "vertex") return null;
  const env = getServerEnv();
  const credentials = parseServiceAccountKey(env.GOOGLE_SERVICE_ACCOUNT_KEY!);
  const location = env.GOOGLE_CLOUD_LOCATION ?? "eu";
  if (!credentials || location === "global") {
    console.warn("[assistant] vertex: key unreadable or location global");
    return null;
  }
  const ai = new GoogleGenAI({
    vertexai: true,
    project: env.GOOGLE_CLOUD_PROJECT!,
    location,
    googleAuthOptions: {
      credentials,
      projectId: env.GOOGLE_CLOUD_PROJECT!,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    },
  });
  const model = env.ASSISTANT_MODEL ?? env.PRACTICE_TEXT_MODEL ?? "gemini-3.8-flash";

  // « low » is the least thinking gemini-3.8-flash accepts: « minimal » was refused in
  // production (400, « Thinking level is unsupported »), ADR-0088.
  const base = (timeout: number) => ({
    labels: LABELS,
    httpOptions: { timeout },
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  });

  return {
    name: "vertex",
    async plan(system, prompt) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            ...base(PLAN_TIMEOUT_MS),
            systemInstruction: system,
            responseMimeType: "application/json",
          },
        });
        const parsed = planSchema.safeParse(JSON.parse(response.text ?? "null"));
        return parsed.success ? parsed.data : null;
      } catch (error) {
        console.warn("[assistant] plan:", (error as Error).message);
        return null;
      }
    },
    async *answer(system, prompt) {
      // Google sometimes sits on a request (production, 2026-11-02: 40 s without a word, 504s
      // on the plan). Not a word within FIRST_WORDS_MS: the request is dropped and made once
      // more; a second silence is the caller's to handle — it answers without the model.
      for (let attempt = 1; ; attempt += 1) {
        const abort = new AbortController();
        const deadline = setTimeout(() => abort.abort(), FIRST_WORDS_MS);
        let started = false;
        try {
          const stream = await ai.models.generateContentStream({
            model,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              ...base(ANSWER_TIMEOUT_MS),
              systemInstruction: system,
              abortSignal: abort.signal,
            },
          });
          for await (const chunk of stream) {
            if (!started) {
              started = true;
              clearTimeout(deadline);
            }
            const text = chunk.text;
            if (text) yield text;
          }
          return;
        } catch (error) {
          if (started || attempt >= 2) throw error;
          console.warn(`[assistant] answer: no first words in ${FIRST_WORDS_MS} ms, trying again`);
        } finally {
          clearTimeout(deadline);
        }
      }
    },
  };
}

/** The plan is optional (the rules stand in): it does not get to hold the answer up. */
const PLAN_TIMEOUT_MS = 8_000;
/** First words usually arrive within 1 to 3 s. */
const FIRST_WORDS_MS = 10_000;
const ANSWER_TIMEOUT_MS = 40_000;

/**
 * A model that calls nobody (`PRACTICE_AI_PROVIDER=fake`): no plan (the caller uses the plan made
 * from the words of the question) and no words, so the caller answers without the model
 * (`lib/assistant/fallback.ts`) — the very path a reader takes when Google does not answer, played
 * in development and in the e2e suite.
 */
function fakeAssistant(): AssistantModel {
  return {
    name: "fake",
    async plan() {
      return null;
    },
    async *answer() {
      return;
    },
  };
}
