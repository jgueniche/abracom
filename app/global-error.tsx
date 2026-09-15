"use client";

import { useEffect } from "react";

import fr from "@/messages/fr.json";

/** Last-resort error page (the root layout itself failed): no providers, catalogue read directly. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Reached only through a dynamic import, and only when a DSN exists. This boundary sits in
    // every route's module graph, so a static `import * as Sentry` puts the whole SDK in the
    // chunk that 76 of 96 functions ship — paid on every cold start, for a page almost never
    // rendered (ADR-0066).
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
  }, [error]);
  const t = fr.errors.unexpected;
  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          padding: "3rem 1.5rem",
          maxWidth: 560,
          margin: "0 auto",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{t.title}</h1>
        <p style={{ color: "#555", marginBottom: "1.5rem" }}>{t.description}</p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: 44,
            padding: "0 1.25rem",
            borderRadius: 8,
            border: 0,
            background: "#0038b8",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          {t.retry}
        </button>
      </body>
    </html>
  );
}
