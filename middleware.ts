import { type NextRequest, NextResponse } from "next/server";

import { APP_HOME_PATH, isPublicPath, LOGIN_PATH } from "@/lib/auth/routes";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, user, configured } = await updateSession(request);
  if (!configured) return response;

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (user && pathname === LOGIN_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = APP_HOME_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icon.png|apple-icon.png|icons/|brand/|manifest.webmanifest|robots.txt|favicon.ico).*)",
  ],
};
