import { NextResponse, type NextRequest } from "next/server";

import {
  buildAuthorizeUrl,
  generatePkcePair,
  generateState,
} from "@/lib/integrations/etsy/oauth";
import {
  setOAuthStateCookie,
  signOAuthState,
} from "@/lib/integrations/etsy/oauth-state";

/**
 * GET /api/etsy/oauth/start
 *
 * Initiates the OAuth dance. Generates a fresh `state` + PKCE pair,
 * stashes them in a short-lived signed cookie, and 303-redirects the
 * browser to Etsy's consent page.
 *
 * Session-gated by `proxy.ts` — only signed-in admins can initiate.
 */
export async function GET(_request: NextRequest) {
  const state = generateState();
  const { codeVerifier, codeChallenge } = generatePkcePair();

  // NOTE: the verifier is the secret half of the PKCE pair — it must
  // round-trip through the signed cookie, not the URL.
  const cookieToken = await signOAuthState({ state, codeVerifier });
  await setOAuthStateCookie(cookieToken);

  const authorizeUrl = buildAuthorizeUrl({ state, codeChallenge });
  return NextResponse.redirect(authorizeUrl, { status: 303 });
}
