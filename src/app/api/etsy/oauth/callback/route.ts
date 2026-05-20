import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db/client";
import { etsyOauth } from "@/lib/db/schema";
import {
  ETSY_SCOPES,
  exchangeCodeForToken,
} from "@/lib/integrations/etsy/oauth";
import {
  clearOAuthStateCookie,
  getOAuthStateCookie,
  verifyOAuthState,
} from "@/lib/integrations/etsy/oauth-state";
import {
  fetchShopByOwnerUserId,
  parseUserIdFromAccessToken,
} from "@/lib/integrations/etsy/shops";
import { devError, devLog } from "@/lib/utils/dev";

/**
 * GET /api/etsy/oauth/callback?code=…&state=…
 *
 * Etsy redirects the user's browser here after the consent screen.
 * Validates the state cookie, exchanges the code for tokens, looks
 * up the shop, and upserts the `etsy_oauth` row keyed by `shop_id`.
 *
 * Errors are reported back to the settings page via the `error` query
 * param — the page renders the Spanish error message for the code.
 */

const SETTINGS_PATH = "/settings/integrations";

type CallbackErrorCode =
  | "etsy_denied"
  | "missing_params"
  | "state_expired"
  | "state_invalid"
  | "state_mismatch"
  | "exchange_failed";

function redirectWithError(request: NextRequest, code: CallbackErrorCode) {
  const url = new URL(SETTINGS_PATH, request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    devError("[etsy.oauth.callback] etsy returned error:", errorParam);
    await clearOAuthStateCookie();
    return redirectWithError(request, "etsy_denied");
  }
  if (!code || !stateParam) {
    await clearOAuthStateCookie();
    return redirectWithError(request, "missing_params");
  }

  // NOTE: state validation — the cookie token both proves the flow
  // started from this server AND carries the PKCE code_verifier.
  const cookieToken = await getOAuthStateCookie();
  if (!cookieToken) {
    return redirectWithError(request, "state_expired");
  }
  const payload = await verifyOAuthState(cookieToken);
  if (!payload) {
    await clearOAuthStateCookie();
    return redirectWithError(request, "state_invalid");
  }
  if (payload.state !== stateParam) {
    await clearOAuthStateCookie();
    return redirectWithError(request, "state_mismatch");
  }

  try {
    const tokens = await exchangeCodeForToken({
      code,
      codeVerifier: payload.codeVerifier,
    });

    const userId = parseUserIdFromAccessToken(tokens.access_token);
    const shop = await fetchShopByOwnerUserId(userId, tokens.access_token);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const scopes = ETSY_SCOPES.join(" ");

    await db
      .insert(etsyOauth)
      .values({
        shopId: shop.shop_id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        scopes,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: etsyOauth.shopId,
        set: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          scopes,
          expiresAt,
          updatedAt: new Date(),
        },
      });

    await clearOAuthStateCookie();
    devLog(
      "[etsy.oauth.callback] connected shop",
      shop.shop_id,
      shop.shop_name,
    );

    const url = new URL(SETTINGS_PATH, request.url);
    url.searchParams.set("connected", "1");
    return NextResponse.redirect(url, { status: 303 });
  } catch (err) {
    devError("[etsy.oauth.callback] failed:", err);
    await clearOAuthStateCookie();
    return redirectWithError(request, "exchange_failed");
  }
}
