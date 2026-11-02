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
            ...base(20_000),
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
      const stream = await ai.models.generateContentStream({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { ...base(40_000), systemInstruction: system },
      });
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) yield text;
      }
    },
  };
}

/**
 * A model that calls nobody (`PRACTICE_AI_PROVIDER=fake`): no plan (the caller uses the plan made
 * from the words of the question), and an answer that reads the tool results back as a list —
 * enough to play the whole path in development and in the e2e suite.
 */
function fakeAssistant(): AssistantModel {
  return {
    name: "fake",
    async plan() {
      return null;
    },
    async *answer(_system, prompt) {
      const results = /Résultats des outils \(JSON\) :\n(.*)\n\nLiens autorisés/s.exec(prompt)?.[1];
      const parsed = results ? (JSON.parse(results) as FakeResult[]) : [];
      const lines: string[] = [];
      for (const result of parsed) {
        const items = result.data?.items ?? result.data?.days ?? [];
        if (items.length === 0) continue;
        lines.push(FAKE_TITLES[result.tool] ?? result.tool);
        for (const item of items.slice(0, 5)) {
          const label = item.title ?? item.student ?? item.day ?? "—";
          const detail = item.due_on ?? item.from ?? item.main_course ?? "";
          lines.push(
            `- ${item.link ? `[${label}](${item.link})` : label}${detail ? ` — ${detail}` : ""}`,
          );
        }
      }
      const text =
        lines.length > 0
          ? lines.join("\n")
          : "Je n'ai rien trouvé à ce sujet dans ce que vous pouvez voir. Regardez dans [Aide](/aide).";
      for (const word of text.split(/(?<= )/)) {
        yield word;
        await new Promise((resolve) => setTimeout(resolve, 4));
      }
    },
  };
}

type FakeResult = {
  tool: string;
  data?: {
    items?: Array<Record<string, string | undefined>>;
    days?: Array<Record<string, string | undefined>>;
  };
};

const FAKE_TITLES: Record<string, string> = {
  homework: "Voici les devoirs :",
  agenda: "Dans l'agenda :",
  menus: "Au menu :",
  announcements: "Les dernières annonces :",
  absences: "Les absences :",
  help: "Dans l'aide :",
  search: "J'ai trouvé :",
};
