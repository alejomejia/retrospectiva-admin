import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Bearer-token guard for the public product API (`/api/public/*`)
 * consumed server-side by `retrospectiva-website`. The store data is
 * public anyway; the token isn't a confidentiality control, it just
 * keeps the endpoint from being trivially scraped/hammered by anyone
 * who finds the URL.
 *
 * The website passes `Authorization: Bearer <PUBLIC_API_TOKEN>`. Both
 * sides read the same secret from env. Comparison is constant-time.
 *
 * NOTE: these routes are excluded from `proxy.ts` session auth, so this
 * is the ONLY gate in front of them — keep it strict.
 */

const BEARER_PREFIX = "Bearer ";

/**
 * Returns `true` when the request carries the correct bearer token.
 * Returns `false` (never throws) on any malformed / missing header so
 * callers can respond with a uniform 401.
 */
export function hasValidPublicApiToken(req: Request): boolean {
  const expected = process.env.PUBLIC_API_TOKEN;
  // Fail closed: an unset secret means the endpoint is unusable rather
  // than open to everyone.
  if (!expected) return false;

  const header = req.headers.get("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) return false;
  const provided = header.slice(BEARER_PREFIX.length);

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
