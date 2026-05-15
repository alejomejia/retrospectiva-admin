import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { config } from "@/lib/utils/config";
import { devWarn } from "@/lib/utils/dev";

/**
 * Short-lived signed cookie that carries the OAuth `state` (CSRF
 * token) and the PKCE `code_verifier` across the user's bounce to
 * Etsy and back.
 *
 * Why signed: the callback handler must trust that the `state` in
 * the cookie really did come from us (so it can compare against the
 * `state` query param Etsy round-trips) and that the `code_verifier`
 * wasn't substituted. HS256 with `SESSION_SECRET` matches the
 * session JWT — reusing the secret is safe because the `aud` claim
 * differentiates this token type from a session token.
 *
 * TTL is 10 minutes — long enough for the user to interact with
 * Etsy's consent page, short enough to limit replay risk.
 */

// NOTE: distinct cookie name from `rsv_session` so the two never
// overlap. HttpOnly + SameSite=Lax mirror the session cookie's
// flags — they're sent on the top-level redirect from Etsy.
export const OAUTH_STATE_COOKIE_NAME = "rsv_etsy_oauth_state";
const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const JWT_ALG = "HS256";
const JWT_AUDIENCE = "etsy-oauth";

const secret = new TextEncoder().encode(config.sessionSecret);

export type OAuthStatePayload = {
  state: string;
  codeVerifier: string;
};

/**
 * Sign a JWT carrying the OAuth state + PKCE verifier. The caller
 * stores the result in the cookie via `setOAuthStateCookie`.
 */
export async function signOAuthState(
  payload: OAuthStatePayload,
): Promise<string> {
  return new SignJWT({
    state: payload.state,
    codeVerifier: payload.codeVerifier,
  })
    .setProtectedHeader({ alg: JWT_ALG })
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_STATE_TTL_SECONDS}s`)
    .sign(secret);
}

/**
 * Verify a previously-signed OAuth state token. Returns the payload
 * on success, `null` on any failure (bad signature, expired, wrong
 * audience, malformed shape). Never throws.
 */
export async function verifyOAuthState(
  token: string,
): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [JWT_ALG],
      audience: JWT_AUDIENCE,
    });
    if (
      typeof payload.state !== "string" ||
      typeof payload.codeVerifier !== "string"
    ) {
      devWarn("oauth-state: token verified but payload shape is wrong");
      return null;
    }
    return { state: payload.state, codeVerifier: payload.codeVerifier };
  } catch (err) {
    devWarn(
      "oauth-state verify failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function cookieAttrs() {
  return {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_STATE_TTL_SECONDS,
  };
}

export async function setOAuthStateCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE_NAME, token, cookieAttrs());
}

export async function getOAuthStateCookie(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(OAUTH_STATE_COOKIE_NAME)?.value;
}

export async function clearOAuthStateCookie(): Promise<void> {
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE_NAME, "", { ...cookieAttrs(), maxAge: 0 });
}
