import "server-only";

import { z } from "zod";

/** Server-only secrets. Never import this module from a Client Component. */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1).optional(),
  /** Bearer secret expected by `/api/jobs/*` (Vercel Cron sends it automatically). */
  CRON_SECRET: z.string().trim().min(16).optional(),
  RESEND_API_KEY: z.string().trim().min(1).optional(),
  EMAIL_FROM: z.string().trim().min(3).optional(),
  VAPID_PRIVATE_KEY: z.string().trim().min(1).optional(),
  VAPID_SUBJECT: z
    .string()
    .trim()
    .regex(/^mailto:/)
    .optional(),
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
  });
}
