import "server-only";

import { getServerEnv } from "@/lib/env.server";

/**
 * Whether practice sheets are offered, read from the environment alone (ADR-0087).
 *
 * Kept apart from `provider.ts` on purpose: the homework page asks this question on every
 * render, and importing the provider would put the Google SDK in its function. Same rule as
 * ADR-0066 — a screen that only shows a link must not ship what the link leads to.
 */
export type PracticeMode = "vertex" | "fake";

export function practiceMode(): PracticeMode | null {
  const env = getServerEnv();
  if (env.PRACTICE_AI_PROVIDER === "off") return null;
  if (env.PRACTICE_AI_PROVIDER === "fake") return "fake";
  return env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_SERVICE_ACCOUNT_KEY ? "vertex" : null;
}

/**
 * Whether the assistant is offered (ADR-0088): the same provider and the same switch as practice
 * sheets — one sub-processor. Read on every page by the shell, so it lives here, not beside the SDK.
 */
export const assistantMode = practiceMode;
