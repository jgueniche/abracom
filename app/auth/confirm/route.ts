import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { syncLocaleCookie } from "@/lib/auth/locale-cookie";
import { LOGIN_PATH, safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["magiclink", "invite", "email", "recovery", "email_change"];

/** Token-hash flow (e-mail templates using {{ .TokenHash }}). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      await syncLocaleCookie(supabase, data.user?.id, response);
      return response;
    }
  }

  return NextResponse.redirect(`${origin}${LOGIN_PATH}?error=link`);
}
