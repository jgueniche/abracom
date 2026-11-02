import "server-only";

import { z } from "zod";

/** Server-only secrets. Never import this module from a Client Component. */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1).optional(),
  /** Bearer secret expected by `/api/jobs/*` (at least 16 characters, checked by the route). */
  CRON_SECRET: z.string().trim().min(1).optional(),
  RESEND_API_KEY: z.string().trim().min(1).optional(),
  EMAIL_FROM: z.string().trim().min(3).optional(),
  VAPID_PRIVATE_KEY: z.string().trim().min(1).optional(),
  /** `mailto:` or `https:` contact for push services (RFC 8292). */
  VAPID_SUBJECT: z
    .string()
    .trim()
    .regex(/^(mailto:|https:\/\/)/)
    .optional(),
  /**
   * Practice sheets (ADR-0087): `vertex` (Google Cloud, EU multi-region), `fake` (a fixed sheet,
   * for development and the e2e suite) or `off`. Unset: Vertex when its credentials are set.
   */
  PRACTICE_AI_PROVIDER: z.enum(["vertex", "fake", "off"]).optional(),
  GOOGLE_CLOUD_PROJECT: z.string().trim().min(1).optional(),
  /** `eu` keeps the processing inside the European Union; never `global` (ADR-0087). */
  GOOGLE_CLOUD_LOCATION: z.string().trim().min(2).optional(),
  /** The service account's JSON key, as is or base64-encoded. */
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().trim().min(1).optional(),
  PRACTICE_TEXT_MODEL: z.string().trim().min(1).optional(),
  PRACTICE_IMAGE_MODEL: z.string().trim().min(1).optional(),
  PRACTICE_TTS_MODEL: z.string().trim().min(1).optional(),
  PRACTICE_TTS_VOICE: z.string().trim().min(1).optional(),
  /** The assistant's model (ADR-0088); by default the one that writes the practice sheets. */
  ASSISTANT_MODEL: z.string().trim().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    SENTRY_DSN: process.env.SENTRY_DSN,
    PRACTICE_AI_PROVIDER: process.env.PRACTICE_AI_PROVIDER || undefined,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION,
    GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    PRACTICE_TEXT_MODEL: process.env.PRACTICE_TEXT_MODEL,
    PRACTICE_IMAGE_MODEL: process.env.PRACTICE_IMAGE_MODEL,
    PRACTICE_TTS_MODEL: process.env.PRACTICE_TTS_MODEL,
    PRACTICE_TTS_VOICE: process.env.PRACTICE_TTS_VOICE,
    ASSISTANT_MODEL: process.env.ASSISTANT_MODEL,
  });
}
