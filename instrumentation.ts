import type { Instrumentation } from "next";

/**
 * Sentry is a no-op until SENTRY_DSN is set (EU region, no PII, see docs/RGPD.md).
 *
 * The SDK is reached only through dynamic imports, and only once a DSN exists. A static
 * `import * as Sentry` here would be pulled into `instrumentation.js`, which every function
 * loads on **every cold start** — 1.7 MB parsed before the first byte of a page that, without a
 * DSN, never calls Sentry at all.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
