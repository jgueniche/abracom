import "server-only";

import { getServerEnv } from "@/lib/env.server";

import { describeKeyValue, parseServiceAccountKey } from "./credentials";
import { fakeProvider } from "./fake";
import type { PracticeProvider } from "./types";
import { vertexProvider } from "./vertex";

/**
 * Which provider prepares practice sheets, from the environment (ADR-0087):
 *
 *   PRACTICE_AI_PROVIDER=off     nobody — the button does not appear
 *   PRACTICE_AI_PROVIDER=fake    a fixed sheet, no network (development, e2e)
 *   PRACTICE_AI_PROVIDER=vertex  Google Cloud, EU multi-region
 *   unset                        Vertex when GOOGLE_CLOUD_PROJECT and the key are set
 *
 * Null means the feature is not offered, which is what a deployment without keys shows.
 */
let cached: { key: string; provider: PracticeProvider | null } | null = null;

export function getPracticeProvider(): PracticeProvider | null {
  const env = getServerEnv();
  const key = [
    env.PRACTICE_AI_PROVIDER,
    env.GOOGLE_CLOUD_PROJECT,
    env.GOOGLE_CLOUD_LOCATION,
    env.GOOGLE_SERVICE_ACCOUNT_KEY?.length,
    env.PRACTICE_TEXT_MODEL,
    env.PRACTICE_IMAGE_MODEL,
    env.PRACTICE_TTS_MODEL,
    env.PRACTICE_TTS_VOICE,
  ].join("|");
  if (cached?.key === key) return cached.provider;
  cached = { key, provider: resolve(env) };
  return cached.provider;
}

function resolve(env: ReturnType<typeof getServerEnv>): PracticeProvider | null {
  const mode = env.PRACTICE_AI_PROVIDER;
  if (mode === "off") return null;
  if (mode === "fake") return fakeProvider();
  if (!env.GOOGLE_CLOUD_PROJECT || !env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    if (mode === "vertex") console.warn("[practice] vertex: GOOGLE_CLOUD_PROJECT or key missing");
    return null;
  }
  const credentials = parseServiceAccountKey(env.GOOGLE_SERVICE_ACCOUNT_KEY);
  if (!credentials) {
    // The shape of the value only — never a character of it.
    console.warn(
      `[practice] vertex: GOOGLE_SERVICE_ACCOUNT_KEY is not a service account key: ${describeKeyValue(env.GOOGLE_SERVICE_ACCOUNT_KEY)}`,
    );
    return null;
  }
  try {
    return vertexProvider({
      project: env.GOOGLE_CLOUD_PROJECT,
      location: env.GOOGLE_CLOUD_LOCATION ?? "eu",
      credentials,
      textModel: env.PRACTICE_TEXT_MODEL ?? "gemini-3.8-flash",
      imageModel: env.PRACTICE_IMAGE_MODEL ?? "gemini-3.1-flash-image",
      ttsModel: env.PRACTICE_TTS_MODEL ?? "gemini-3.8-flash-tts",
      voice: env.PRACTICE_TTS_VOICE ?? "Sulafat",
    });
  } catch (error) {
    console.warn("[practice] vertex:", (error as Error).message);
    return null;
  }
}
