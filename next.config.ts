import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

/**
 * `NEXT_PUBLIC_*` values are baked into the browser bundle while the page is
 * compiled, not read when it runs. A deployment built without them therefore
 * ships an application that cannot reach Supabase at all, and says so only
 * through a small notice on the sign-in page — which is how a production build
 * once went out silently broken.
 *
 * On Vercel (production and preview) the build now stops instead. Local builds
 * and CI have no `VERCEL_ENV` and are untouched: the app is meant to boot
 * without a Supabase stack.
 */
function assertPublicSupabaseConfigAtBuildTime(): void {
  const target = process.env.VERCEL_ENV;
  if (target !== "production" && target !== "preview") return;
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length === 0) return;

  // What the build actually received, so the log answers "is it there, is it
  // named differently, is it empty" instead of leaving it to guesswork.
  // Names and lengths only: no value is ever printed.
  const seen = Object.keys(process.env)
    .filter((name) => name.startsWith("NEXT_PUBLIC_"))
    .sort()
    .map((name) => `${name} (${process.env[name]?.length ?? 0} caractères)`);
  const inventory =
    seen.length > 0
      ? `Variables NEXT_PUBLIC_* reçues par ce build :\n  - ${seen.join("\n  - ")}`
      : "Ce build n'a reçu AUCUNE variable NEXT_PUBLIC_*.";

  throw new Error(
    `Build ${target} sans ${missing.join(" ni ")} : ces variables sont lues à la compilation, ` +
      "pas à l'exécution.\n" +
      inventory +
      "\nSi le nom attendu ne figure pas dans cette liste, la variable n'est pas fournie à " +
      "l'étape de build pour cet environnement (Settings → Environment Variables).",
  );
}

assertPublicSupabaseConfigAtBuildTime();

/**
 * Baseline security headers. A strict nonce-based CSP is scheduled for
 * session 14 (docs/ROADMAP.md) because it requires middleware support.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // PDF rendering runs in Node.js only (report cards): keep the package out of the bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Help articles are read at request time (content/help): keep them in the serverless bundle.
  outputFileTracingIncludes: {
    "/aide": ["./content/help/**/*"],
    "/aide/[slug]": ["./content/help/**/*"],
    "/aide/quoi-de-neuf": ["./content/help/**/*"],
    "/api/aide/guide": ["./content/help/**/*"],
    // The "?" in every page header resolves the article for the current path.
    "/(app)/layout": ["./content/help/**/*"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  webpack(config) {
    // Sentry's OpenTelemetry instrumentation hooks `require` dynamically; the warning is expected
    // (same rule as `withSentryConfig`, which is not used because source maps are not uploaded).
    const rules = [
      { module: /@opentelemetry\/instrumentation/, message: /Critical dependency/ },
      { module: /require-in-the-middle/, message: /Critical dependency/ },
    ];
    config.ignoreWarnings = [...(config.ignoreWarnings ?? []), ...rules];
    return config;
  },
};

export default withNextIntl(nextConfig);
