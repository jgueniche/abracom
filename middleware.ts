import { type NextRequest, NextResponse } from "next/server";

import { APP_HOME_PATH, isPublicPath, LOGIN_PATH } from "@/lib/auth/routes";
import { buildCsp, createNonce } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    dev: process.env.NODE_ENV === "development",
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  requestHeaders.set("content-security-policy", csp);
  const secured = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  const { response, user, configured } = await updateSession(request, requestHeaders);
  if (!configured) return secured(response);

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return secured(NextResponse.redirect(url));
  }

  if (user && pathname === LOGIN_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = APP_HOME_PATH;
    url.search = "";
    return secured(NextResponse.redirect(url));
  }

  return secured(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon.png|apple-icon.png|icons/|brand/|manifest.webmanifest|robots.txt|favicon.ico|sw.js).*)",
  ],
};
