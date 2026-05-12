import "server-only";

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

import { config } from "@/lib/utils/config";
import { devWarn } from "@/lib/utils/dev";

/**
 * Session = signed JWT in an HttpOnly cookie. Verified on every request
 * by `proxy.ts` and refreshed there (sliding 7-day expiry).
 *
 * Algorithm: HS256 with `SESSION_SECRET`. No DB lookup involved; logout
 * simply clears the cookie.
 */

export const SESSION_COOKIE_NAME = "rsv_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const JWT_ALG = "HS256";

// NOTE: the secret is encoded once. Re-encoding per request would be wasteful.
const secret = new TextEncoder().encode(config.sessionSecret);

export type SessionPayload = JWTPayload & {
  /** Username from ALLOW_USERS. */
  sub: string;
};

/**
 * Mints a fresh session token for the given username.
 *
 * @example
 *   const token = await signSession("alejandro");
 */
export async function signSession(username: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

/**
 * Verifies a token. Returns the payload on success, `null` on any failure
 * (bad signature, expired, malformed). Never throws.
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [JWT_ALG] });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      devWarn("session: jwt verified but `sub` claim is missing");
      return null;
    }
    return payload as SessionPayload;
  } catch (err) {
    devWarn("session verify failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Common cookie attributes shared by set/clear. */
function cookieAttrs() {
  return {
    httpOnly: true,
    // NOTE: Secure flag in production only — local dev runs on http://localhost.
    secure: config.env === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, cookieAttrs());
}

export async function getSessionCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value;
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", { ...cookieAttrs(), maxAge: 0 });
}

/** Exposed so proxy.ts can re-set the cookie with sliding expiry. */
export function sessionCookieOptions() {
  return cookieAttrs();
}
