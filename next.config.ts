import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

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
  // Markdown guides are read at request time (content/guides): keep them in the serverless bundle.
  outputFileTracingIncludes: {
    "/aide/[slug]": ["./content/guides/**/*"],
    "/api/guides/[slug]": ["./content/guides/**/*"],
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
