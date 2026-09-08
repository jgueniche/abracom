import { z } from "zod";

/**
 * Public (browser-safe) environment. Only NEXT_PUBLIC_* variables belong here.
 * Values are referenced literally so Next.js can inline them at build time.
 * Server secrets live in `lib/env.server.ts`.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).default("Kesher"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_EDUCARTABLE_URL: z.url().default("https://www.edumoov.com/educartable"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().trim().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_APP_NAME: emptyToUndefined(source.NEXT_PUBLIC_APP_NAME),
    NEXT_PUBLIC_SITE_URL: emptyToUndefined(source.NEXT_PUBLIC_SITE_URL),
    NEXT_PUBLIC_SUPABASE_URL: emptyToUndefined(source.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: emptyToUndefined(source.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_EDUCARTABLE_URL: emptyToUndefined(source.NEXT_PUBLIC_EDUCARTABLE_URL),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: emptyToUndefined(source.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  });
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

export const publicEnv: PublicEnv = parsePublicEnv({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_EDUCARTABLE_URL: process.env.NEXT_PUBLIC_EDUCARTABLE_URL,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
});

export const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

export class MissingSupabaseConfigError extends Error {
  constructor() {
    super(
      "Configuration Supabase manquante : définissez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (voir .env.example).",
    );
    this.name = "MissingSupabaseConfigError";
  }
}

/** Resolved lazily so the app boots (session 1) before a Supabase stack exists. */
export function getSupabasePublicConfig(env: PublicEnv = publicEnv): {
  url: string;
  anonKey: string;
} {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new MissingSupabaseConfigError();
  }
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
}
