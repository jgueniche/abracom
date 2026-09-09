"use client";

import * as Sentry from "@sentry/nextjs";
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
    Sentry.captureException(error);
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
            background: "#01525e",
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
