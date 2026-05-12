/**
 * In-memory soft rate limiter for login attempts. Per (IP + username)
 * pair: 5 failed attempts in a 15-minute window locks that pair out
 * until the window expires. Other usernames from the same IP are not
 * affected (a typo on `alejandro` shouldn't lock out `pia`).
 *
 * In-memory is fine for a two-person admin running 1–2 containers. If
 * we ever scale the app horizontally, swap the Map for a Redis sorted
 * set without changing the call sites.
 *
 * Not security-critical (bcrypt cost 12 already makes brute force
 * infeasible) — this is defense in depth + nicer UX on flubbed typing.
 */

export const RATE_LIMIT_MAX_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

/**
 * Records an attempt and returns whether it's allowed to proceed.
 *
 * Call this BEFORE the password check (so denied attempts don't trigger
 * the bcrypt round-trip). On a successful login, call `resetRate(key)`
 * to clear the bucket so legit users don't carry over a stale count.
 */
export function checkRate(key: string, now: number = Date.now()): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (bucket.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { allowed: true };
}

export function resetRate(key: string): void {
  buckets.delete(key);
}

/** Test-only — clear every bucket between tests. */
export function __resetAllRateLimitBuckets(): void {
  buckets.clear();
}
