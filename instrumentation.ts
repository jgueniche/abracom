import * as Sentry from "@sentry/nextjs";

/** Sentry is a no-op until SENTRY_DSN is set (EU region, no PII, see docs/RGPD.md). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

export const onRequestError = Sentry.captureRequestError;
