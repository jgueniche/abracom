import "server-only";

import { z } from "zod";

/** Server-only secrets. Never import this module from a Client Component. */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
