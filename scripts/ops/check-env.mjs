#!/usr/bin/env node
/**
 * Environment checklist before a production switch (docs/DEPLOIEMENT.md).
 *   pnpm ops:check-env            # warns about missing optional variables
 *   pnpm ops:check-env --prod     # exits 1 when a production requirement is missing
 * Reads process.env: run after `vercel env pull .env.production.local` and `set -a; source …`.
 */
const prod = process.argv.includes("--prod");
const checks = [
  ["NEXT_PUBLIC_SITE_URL", (v) => /^https:\/\//.test(v), "https URL", true],
  [
    "NEXT_PUBLIC_SUPABASE_URL",
    (v) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(v),
    "Supabase project URL",
    true,
  ],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", (v) => v.length > 40, "anon key", true],
  ["SUPABASE_SERVICE_ROLE_KEY", (v) => v.length > 40, "service role key (server only)", true],
  ["CRON_SECRET", (v) => v.length >= 32, "at least 32 characters", true],
  ["RESEND_API_KEY", (v) => v.startsWith("re_"), "Resend key", true],
  ["EMAIL_FROM", (v) => /<.+@.+>/.test(v) || /@/.test(v), "sender address", true],
  ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", (v) => v.length > 40, "VAPID public key", true],
  ["VAPID_PRIVATE_KEY", (v) => v.length > 20, "VAPID private key", true],
  ["VAPID_SUBJECT", (v) => v.startsWith("mailto:"), "mailto: subject", true],
  ["SENTRY_DSN", (v) => /^https:\/\//.test(v), "Sentry DSN (EU)", false],
  ["NEXT_PUBLIC_SENTRY_DSN", (v) => /^https:\/\//.test(v), "Sentry DSN (EU)", false],
];
let failed = false;
for (const [name, valid, hint, required] of checks) {
  const value = process.env[name] ?? "";
  const state =
    value === "" ? (required ? "MISSING" : "optional") : valid(value) ? "ok" : "INVALID";
  if (prod && required && state !== "ok") failed = true;
  console.log(`${state.padEnd(8)} ${name.padEnd(32)} ${hint}`);
}
if (
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !/supabase\.co$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL)
) {
  console.log("note     the Supabase URL does not look like a cloud project (local stack?)");
}
if (failed) {
  console.error("\nProduction requirements are not met.");
  process.exit(1);
}
