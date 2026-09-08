import "server-only";

import { createClient } from "@/lib/supabase/server";

export type MfaStatus = {
  /** A TOTP factor is verified (enrolment completed). */
  enrolled: boolean;
  /** The current session was elevated with a code (AAL2). */
  verified: boolean;
  factorId: string | null;
};

/** Two-factor state of the signed-in user (Supabase Auth MFA, TOTP). */
export async function getMfaStatus(): Promise<MfaStatus> {
  const supabase = await createClient();
  const [{ data: factors }, { data: level }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const factor = factors?.totp.find((f) => f.status === "verified") ?? null;
  return {
    enrolled: factor !== null,
    verified: level?.currentLevel === "aal2",
    factorId: factor?.id ?? null,
  };
}
