import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, homePathFor, isPortalRole, verifySessionToken } from "@/lib/auth-token";

const PUBLIC_PATHS = ["/login", "/register"];

/**
 * Cheap edge-level gate: signed-out visitors never reach an app route, signed-in
 * ones skip the auth pages, and each role is kept inside its own area. The
 * `requireUser()` / `requirePortalUser()` calls in each page and action remain
 * the authoritative checks — this only saves a round trip.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    return NextResponse.redirect(url);
  };

  if (!session && !isPublic) return redirectTo("/login");
  if (session && isPublic) return redirectTo(homePathFor(session.role));

  if (session) {
    const portal = isPortalRole(session.role);
    const inPortal = pathname === "/portal" || pathname.startsWith("/portal/");
    // Downloads are authorised per-file inside the route handler, so both roles
    // may reach them.
    const shared = pathname.startsWith("/api/");

    if (portal && !inPortal && !shared) return redirectTo("/portal");
    if (!portal && inPortal) return redirectTo("/dashboard");
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, the favicon and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
