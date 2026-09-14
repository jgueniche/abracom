import "server-only";

import type { CurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type MfaStatus = {
  /** A TOTP factor is verified (enrolment completed). */
  enrolled: boolean;
  /** The current session was elevated with a code (AAL2). */
  verified: boolean;
};

/**
 * Two-factor state of the signed-in user, for the shell and the guards.
 *
 * It used to call `supabase.auth.mfa.listFactors()`, which is `getUser()` under
 * another name: an HTTP round trip to the auth server, on every page, for two
 * booleans (ADR-0061). The assurance level is a claim of the token the browser
 * already sent, so it costs nothing; whether a factor exists is one row of
 * `auth.mfa_factors`, which `mfa_enrolled()` reads in Postgres alongside the
 * other queries of the same stage.
 */
export async function getMfaStatus(user: CurrentUser): Promise<MfaStatus> {
  return { enrolled: await isMfaEnrolled(), verified: user.aal === "aal2" };
}

/** The enrolment half on its own, so it can be fetched beside the profile. */
export async function isMfaEnrolled(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("mfa_enrolled");
  return data === true;
}

/**
 * The identifier of the verified TOTP factor — needed to challenge it.
 *
 * This one does talk to the auth server, and should: it is called by the
 * security screen and by the three actions that enrol, disable or verify a
 * factor, never by a page a reader merely passes through.
 */
export async function getMfaFactorId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp.find((f) => f.status === "verified")?.id ?? null;
}
