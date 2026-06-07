import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "@/lib/auth/session";

/**
 * Route protection. Runs ahead of every matched request (see matcher
 * below). If the session cookie is missing or invalid, redirect to
 * /login with `?next=` set so we can bounce back after sign-in. On a
 * valid cookie, re-issue it with a fresh expiry — gives us a sliding
 * 7-day session so daily users never get bounced mid-task.
 *
 * NOTE: webhooks (`/api/webhooks/*`) are deliberately excluded from the
 * matcher because they authenticate via HMAC, not session.
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return redirectToLogin(request);

  const payload = await verifySession(token);
  if (!payload?.sub) return redirectToLogin(request);

  // Sliding expiry: re-mint and re-attach the cookie on every authed hit.
  const response = NextResponse.next();
  const refreshed = await signSession(payload.sub);
  response.cookies.set(SESSION_COOKIE_NAME, refreshed, sessionCookieOptions());
  return response;
}

function redirectToLogin(request: NextRequest) {
  const target = request.nextUrl.clone();
  const original = request.nextUrl.pathname + request.nextUrl.search;
  target.pathname = "/login";
  target.search = "";
  // Avoid `?next=/login` loops if someone hits /login while already on /login.
  if (original && original !== "/login") {
    target.searchParams.set("next", original);
  }
  return NextResponse.redirect(target);
}

export const config = {
  // Match everything EXCEPT the public surface and Next/static assets.
  // - `login` → the sign-in page itself
  // - `api/auth/*` → login/logout server-side flows
  // - `api/webhooks/*` → HMAC-authed, not session-authed
  // - `api/public/*` → bearer-token-authed (public store API), not session
  // - `api/health` → for Docker healthchecks
  // - `robots.txt` → must be readable by crawlers without a session
  // - `_next/*`, common image extensions → static assets
  matcher: [
    "/((?!login|api/auth|api/webhooks|api/public|api/health|robots\\.txt|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp|avif)).*)",
  ],
};
