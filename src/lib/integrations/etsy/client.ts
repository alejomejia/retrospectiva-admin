import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { etsyOauth } from "@/lib/db/schema";
import { devError } from "@/lib/utils/dev";

import {
  type EtsyTokenResponse,
  refreshAccessToken,
} from "./oauth";

// NOTE: this module is on the worker's import chain (via
// `publish.ts` → `listings.ts`), so it can't depend on
// `@/lib/utils/config` (`server-only` blocks tsx). Read env directly;
// see `docs/project-conventions.md` §1.
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/**
 * Authenticated fetch wrapper for Etsy Open API v3.
 *
 * Reads the stored OAuth row, lazily refreshes the access token if
 * it's within `REFRESH_BUFFER_MS` of expiry, and attaches the two
 * headers every Etsy v3 endpoint requires:
 *   - `Authorization: Bearer <access_token>` (the user's grant)
 *   - `x-api-key: <keystring>:<shared_secret>` (NOT one or the
 *     other — both, colon-separated). Etsy v3 docs:
 *     "Your Etsy App API Key keystring and shared secret,
 *     separated by a colon (`:`)."
 *
 * If you ever see `403 "Shared secret is required in x-api-key
 * header."`, you sent only the keystring. If you see
 * `403 "API key not found or not active, or incorrect shared
 * secret for API key."`, you sent only the secret. The header is
 * a pair.
 *
 * Etsy v3 reference:
 *   https://developers.etsy.com/documentation/essentials/authentication
 *   https://developers.etsy.com/documentation/essentials/requests
 */

const ETSY_API_BASE = "https://openapi.etsy.com/v3/application";

// NOTE: refresh REFRESH_BUFFER_MS before the token actually expires
// so a near-expired token doesn't get sent on a request that races
// the rotation. 60s leaves room for clock skew + the refresh round-
// trip itself.
const REFRESH_BUFFER_MS = 60_000;

export type EtsyOAuthRow = typeof etsyOauth.$inferSelect;

/**
 * Pluggable read/update layer over the `etsy_oauth` row. The default
 * implementation hits the DB. Tests inject an in-memory store so the
 * client wrapper can be exercised without a Postgres instance.
 */
export type TokenStore = {
  read: () => Promise<EtsyOAuthRow | null>;
  update: (id: string, tokens: EtsyTokenResponse) => Promise<EtsyOAuthRow>;
};

const defaultTokenStore: TokenStore = {
  async read() {
    const rows = await db.select().from(etsyOauth).limit(1);
    return rows[0] ?? null;
  },
  async update(id, tokens) {
    const [updated] = await db
      .update(etsyOauth)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(eq(etsyOauth.id, id))
      .returning();
    if (!updated) {
      throw new Error(`etsy_oauth row ${id} disappeared during refresh`);
    }
    return updated;
  },
};

export class EtsyNotConnectedError extends Error {
  constructor() {
    super("Etsy is not connected — no etsy_oauth row found.");
    this.name = "EtsyNotConnectedError";
  }
}

/**
 * Reads the active OAuth row, refreshes the token if it's near expiry,
 * and returns a guaranteed-fresh access token.
 *
 * @throws {EtsyNotConnectedError} if no `etsy_oauth` row exists yet —
 *   the caller (typically a settings page) should prompt the user to
 *   click "Conectar con Etsy".
 * @throws {EtsyOAuthError} if Etsy rejects the refresh (token revoked,
 *   scopes changed, etc.) — the caller should treat this the same as
 *   "not connected" and re-prompt.
 *
 * @example
 *   const { accessToken } = await getValidAccessToken();
 */
export async function getValidAccessToken(
  store: TokenStore = defaultTokenStore,
): Promise<{ accessToken: string; row: EtsyOAuthRow }> {
  const row = await store.read();
  if (!row) {
    throw new EtsyNotConnectedError();
  }
  const msUntilExpiry = row.expiresAt.getTime() - Date.now();
  if (msUntilExpiry > REFRESH_BUFFER_MS) {
    return { accessToken: row.accessToken, row };
  }
  const tokens = await refreshAccessToken(row.refreshToken);
  const updated = await store.update(row.id, tokens);
  return { accessToken: updated.accessToken, row: updated };
}

/**
 * Make an authenticated request to Etsy's v3 application API.
 *
 * Auto-refreshes the access token if it's near expiry, attaches the
 * two required headers, and returns the raw `Response`. Callers parse
 * the body based on the specific endpoint.
 *
 * @param path - path under `/v3/application/`, e.g. `/users/me/shops`
 * @param init - standard fetch init (method, body, headers, …)
 * @param store - injectable token store; defaults to the DB-backed one
 *
 * @example
 *   const res = await etsyFetch("/users/me/shops");
 *   if (!res.ok) throw new Error("shop fetch failed");
 *   const { results } = await res.json();
 */
export async function etsyFetch(
  path: string,
  init: RequestInit = {},
  store: TokenStore = defaultTokenStore,
): Promise<Response> {
  const { accessToken } = await getValidAccessToken(store);
  const url = `${ETSY_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      // NOTE: `x-api-key` is the colon-joined pair
      // `<keystring>:<shared_secret>`. See file-top docblock.
      "x-api-key": `${requireEnv("ETSY_CLIENT_ID")}:${requireEnv("ETSY_CLIENT_SECRET")}`,
    },
  });

  if (!res.ok) {
    const body = await res
      .clone()
      .text()
      .catch(() => "");
    devError("[etsy.client]", res.status, path, body);
  }

  return res;
}

export const __etsyApiBase = ETSY_API_BASE;
