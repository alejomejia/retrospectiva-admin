import "server-only";

import { config } from "@/lib/utils/config";

/**
 * Domain helpers for Etsy v3 shop endpoints.
 *
 * The OAuth token response from Etsy does NOT include the shop id —
 * it only returns `access_token`, `refresh_token`, `expires_in`,
 * `token_type`. To discover which shop a token belongs to we parse
 * the user_id out of the access token (Etsy encodes it as the
 * `<user_id>.<token>` prefix), then hit `/users/{user_id}/shops`.
 *
 * Reference:
 *   https://developers.etsy.com/documentation/essentials/authentication#using-the-access-token
 */

const ETSY_API_BASE = "https://openapi.etsy.com/v3/application";

export type Shop = {
  shop_id: number;
  shop_name: string;
  user_id: number;
  currency_code?: string;
  url?: string;
};

/**
 * Etsy v3 access tokens are formatted `<user_id>.<random_token>`.
 * Parse the numeric user_id out of the prefix. Used by the OAuth
 * callback to discover which Etsy account a brand-new token belongs
 * to (the token response itself omits both user_id and shop_id).
 *
 * @throws if the token doesn't follow the documented format.
 *
 * @example
 *   parseUserIdFromAccessToken("12345678.abcdef…") // 12345678
 */
export function parseUserIdFromAccessToken(accessToken: string): number {
  const [head] = accessToken.split(".");
  const userId = Number(head);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("Access token does not start with a numeric user_id");
  }
  return userId;
}

/**
 * Fetch the shop owned by `userId`. Used by the OAuth callback right
 * after token exchange, before the `etsy_oauth` row exists — so it
 * takes an explicit `accessToken` rather than going through the DB-
 * backed `etsyFetch`.
 *
 * @throws if Etsy returns a non-2xx (no shop registered, token
 *   rejected, network failure).
 *
 * @example
 *   const userId = parseUserIdFromAccessToken(tokens.access_token);
 *   const shop = await fetchShopByOwnerUserId(userId, tokens.access_token);
 *   // shop.shop_id, shop.shop_name
 */
export async function fetchShopByOwnerUserId(
  userId: number,
  accessToken: string,
): Promise<Shop> {
  const res = await fetch(`${ETSY_API_BASE}/users/${userId}/shops`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // NOTE: `x-api-key` is `<keystring>:<shared_secret>` —
      // see `client.ts` for the full explanation.
      "x-api-key": `${config.etsyClientId}:${config.etsyClientSecret}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Etsy /users/${userId}/shops failed: ${res.status} ${body}`,
    );
  }
  return res.json() as Promise<Shop>;
}
