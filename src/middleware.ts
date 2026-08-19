import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, homePathFor, isPortalRole, verifySessionToken } from "@/lib/auth-token";

const PUBLIC_PATHS = ["/login", "/register"];

/** Reachable without a session: the load balancer must not be redirected to /login. */
const UNAUTHENTICATED_PATHS = ["/api/health", "/robots.txt"];

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy for the current request.
 *
 * Scripts are allowed only by nonce plus `strict-dynamic`, so an injected
 * `<script>` cannot run even if markup escaping were ever bypassed. Next.js
 * reads the nonce back out of this header and stamps it onto the scripts it
 * emits, which is why it is set on the request as well as the response.
 */
function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    // `unsafe-eval` is only needed by the dev server's hot reloader.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // Tailwind ships a stylesheet, but React still inlines a few style
    // attributes; nonces do not apply to those, so inline styles are allowed.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // The dev server talks over a websocket.
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
    // No plugins, and no <base> rewriting where links point.
    "object-src 'none'",
    "base-uri 'self'",
    // Forms may only post back to this origin.
    "form-action 'self'",
    // Not embeddable anywhere — blocks clickjacking of the admin app.
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Cheap edge-level gate: signed-out visitors never reach an app route, signed-in
 * ones skip the auth pages, and each role is kept inside its own area. The
 * `requireUser()` / `requirePortalUser()` calls in each page and action remain
 * the authoritative checks — this only saves a round trip.
 *
 * It also attaches the per-request CSP nonce.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = contentSecurityPolicy(nonce);

  // Next reads the nonce from the *request* header when rendering.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const withPolicy = <T extends NextResponse>(response: T): T => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  const proceed = () =>
    withPolicy(NextResponse.next({ request: { headers: requestHeaders } }));

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    return withPolicy(NextResponse.redirect(url));
  };

  if (UNAUTHENTICATED_PATHS.some((path) => pathname === path)) return proceed();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

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

  return proceed();
}

export const config = {
  // Everything except Next internals, the favicon and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
