import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

/**
 * POST /api/auth/logout
 *
 * Clears the session cookie and 303-redirects to /login. The browser
 * follows with a GET (303 is the spec-correct status for "POST → GET
 * redirect" after a state change).
 *
 * Whitelisted in proxy.ts so it's reachable while signed in.
 */
export async function POST(request: NextRequest) {
  await clearSessionCookie();
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url, { status: 303 });
}
