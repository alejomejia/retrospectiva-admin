import { createHash, randomBytes } from "node:crypto";

import { devError, devLog } from "@/lib/utils/dev";

// NOTE: this module is on the worker's import chain (via
// `etsy/client.ts` → `refreshAccessToken`), so it can't depend on
// `@/lib/utils/config` (`server-only` blocks tsx). Read env directly;
// see `docs/overview/project-conventions.md` §1.
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/**
 * Etsy Open API v3 OAuth 2.0 + PKCE flow.
 *
 * Etsy uses a public-client PKCE flow at the token endpoint:
 *   - The `client_secret` is NEVER sent on token exchange — instead
 *     the caller proves possession of the original authorize request
 *     by sending the `code_verifier` whose SHA-256 hash matches the
 *     `code_challenge` that initiated the flow.
 *   - The `client_secret` env var is still required because Etsy
 *     issues one when you register the app and we keep it on hand
 *     for HMAC verification on the (optional) webhooks beta.
 *
 * Refresh tokens rotate on every refresh: every successful refresh
 * response includes a NEW `refresh_token` that supersedes the old one.
 * Callers MUST persist the new refresh token immediately or the next
 * refresh will fail.
 *
 * Etsy API docs:
 *   https://developers.etsy.com/documentation/essentials/authentication
 *   https://developers.etsy.com/documentation/tutorials/quickstart/
 */

// NOTE: the authorize page lives on www.etsy.com (the user's browser
// is redirected here), but the token endpoint lives on api.etsy.com
// (server-to-server). Two different hosts — both are correct.
const ETSY_AUTHORIZE_URL = "https://www.etsy.com/oauth/connect";
const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";

/**
 * Scopes the admin requests on every authorize flow. Stored on the
 * `etsy_oauth` row as a space-separated string so we can detect drift
 * if we ever add a scope and need to re-authorize.
 */
export const ETSY_SCOPES = [
  "listings_w",
  "listings_r",
  "shops_r",
] as const;

export type EtsyTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "Bearer";
};

export type PkcePair = {
  codeVerifier: string;
  codeChallenge: string;
};

/**
 * Custom error so callers (the callback route handler) can
 * differentiate "Etsy rejected the token exchange" from a generic
 * `fetch` failure (e.g. network error) when deciding how to surface
 * the error.
 */
export class EtsyOAuthError extends Error {
  readonly status?: number;
  readonly body?: string;
  constructor(message: string, opts?: { status?: number; body?: string }) {
    super(message);
    this.name = "EtsyOAuthError";
    this.status = opts?.status;
    this.body = opts?.body;
  }
}

/**
 * Cryptographically random base64url string. Used for both the
 * OAuth `state` (CSRF token) and the PKCE `code_verifier`.
 *
 * 32 random bytes → 43 base64url chars, which is exactly the minimum
 * length RFC 7636 requires for a PKCE verifier and is composed only
 * of the URL-safe unreserved character set.
 *
 * @param byteLength - number of random bytes (default 32)
 *
 * @example
 *   randomBase64Url();      // "Pn8Cg…43 chars total"
 *   randomBase64Url(48);    // 64 chars
 */
function randomBase64Url(byteLength: number = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/**
 * Generate the OAuth `state` parameter — opaque random string round-
 * tripped through Etsy's authorize page so the callback handler can
 * verify it wasn't initiated by a third party.
 *
 * @example
 *   const state = generateState();
 *   // store in a short-lived signed cookie, then compare on callback
 */
export function generateState(): string {
  return randomBase64Url(32);
}

/**
 * Generate a PKCE `code_verifier` + `code_challenge` pair.
 *
 * The verifier is a random base64url string. The challenge is the
 * base64url-encoded SHA-256 hash of the verifier (`S256` method —
 * the only method Etsy supports).
 *
 * @example
 *   const { codeVerifier, codeChallenge } = generatePkcePair();
 *   // - send `codeChallenge` in the authorize URL
 *   // - store `codeVerifier` in a short-lived signed cookie
 *   // - send `codeVerifier` (not the challenge) on token exchange
 */
export function generatePkcePair(): PkcePair {
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

/**
 * Build the URL that initiates Etsy's OAuth dance. The caller redirects
 * the browser here; Etsy renders its consent page and (on approval)
 * redirects back to `ETSY_REDIRECT_URI` with `?code=…&state=…`.
 *
 * @example
 *   const state = generateState();
 *   const { codeVerifier, codeChallenge } = generatePkcePair();
 *   // persist { state, codeVerifier } in a signed cookie
 *   const url = buildAuthorizeUrl({ state, codeChallenge });
 *   redirect(url);
 */
export function buildAuthorizeUrl({
  state,
  codeChallenge,
}: {
  state: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: requireEnv("ETSY_CLIENT_ID"),
    redirect_uri: requireEnv("ETSY_REDIRECT_URI"),
    scope: ETSY_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${ETSY_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange the authorization `code` returned to the callback URL for
 * an access token + refresh token. Sends the PKCE `code_verifier`
 * (NOT the challenge) — Etsy hashes it and compares to the challenge
 * that initiated the flow.
 *
 * @throws {EtsyOAuthError} if Etsy returns a non-2xx response. The
 *   error carries the status + body for logging.
 *
 * @example
 *   const tokens = await exchangeCodeForToken({
 *     code: searchParams.get("code")!,
 *     codeVerifier: cookies.codeVerifier,
 *   });
 *   // tokens.expires_in is seconds — convert to a timestamp for storage
 *   const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
 */
export async function exchangeCodeForToken({
  code,
  codeVerifier,
}: {
  code: string;
  codeVerifier: string;
}): Promise<EtsyTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: requireEnv("ETSY_CLIENT_ID"),
    redirect_uri: requireEnv("ETSY_REDIRECT_URI"),
    code,
    code_verifier: codeVerifier,
  });

  const res = await fetch(ETSY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    devError("[etsy.oauth] code exchange failed", res.status, text);
    throw new EtsyOAuthError("Etsy token exchange failed", {
      status: res.status,
      body: text,
    });
  }

  const json = (await res.json()) as EtsyTokenResponse;
  devLog("[etsy.oauth] code exchange OK; expires in", json.expires_in, "s");
  return json;
}

/**
 * Rotate a refresh token for a new access token + refresh token pair.
 * Every successful response includes a NEW `refresh_token` — the
 * caller must persist it immediately or the next refresh will fail.
 *
 * @throws {EtsyOAuthError} if Etsy returns a non-2xx response.
 *
 * @example
 *   const tokens = await refreshAccessToken(row.refreshToken);
 *   await db.update(etsyOauth).set({
 *     accessToken: tokens.access_token,
 *     refreshToken: tokens.refresh_token,
 *     expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
 *     updatedAt: new Date(),
 *   }).where(eq(etsyOauth.id, row.id));
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<EtsyTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: requireEnv("ETSY_CLIENT_ID"),
    refresh_token: refreshToken,
  });

  const res = await fetch(ETSY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    devError("[etsy.oauth] refresh failed", res.status, text);
    throw new EtsyOAuthError("Etsy token refresh failed", {
      status: res.status,
      body: text,
    });
  }

  return (await res.json()) as EtsyTokenResponse;
}

// Exported for tests that need to assert against the canonical URLs.
export const __endpoints = {
  authorize: ETSY_AUTHORIZE_URL,
  token: ETSY_TOKEN_URL,
} as const;
