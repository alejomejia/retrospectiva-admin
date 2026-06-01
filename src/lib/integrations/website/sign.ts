import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC scheme shared with the `retrospectiva-website` consumer.
 *
 * - Algorithm: HMAC-SHA-256.
 * - Signed string: `${timestamp}.${rawBody}` — the timestamp is
 *   bound into the MAC so a captured signature can't be replayed
 *   against a different body, and the consumer enforces a replay
 *   window on the timestamp.
 * - Timestamp: seconds since epoch, decimal, as a string.
 * - Signature: lowercase hex.
 *
 * Wire format (request headers):
 *   X-Webhook-Timestamp: <unix-seconds>
 *   X-Webhook-Signature: sha256=<hex>
 */

export const SIGNATURE_HEADER = "X-Webhook-Signature";
export const TIMESTAMP_HEADER = "X-Webhook-Timestamp";
export const SIGNATURE_PREFIX = "sha256=";

/** Window in seconds the consumer should accept timestamps within. */
export const REPLAY_WINDOW_SECONDS = 5 * 60;

export type SignedHeaders = {
  [SIGNATURE_HEADER]: string;
  [TIMESTAMP_HEADER]: string;
};

/**
 * Signs `body` with `secret` and returns headers ready to merge
 * into a fetch request. `timestamp` is exposed for tests; in
 * production callers should rely on the default (now).
 *
 * @example
 *   const body = JSON.stringify(payload);
 *   const headers = signWebhook(body, config.websiteWebhookSecret);
 *   await fetch(url, { method: "POST", headers, body });
 */
export function signWebhook(
  body: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): SignedHeaders {
  const ts = String(timestamp);
  const mac = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  return {
    [TIMESTAMP_HEADER]: ts,
    [SIGNATURE_HEADER]: `${SIGNATURE_PREFIX}${mac}`,
  };
}

/**
 * Constant-time verification of a signed request — exported for
 * symmetry / tests; the consumer in `retrospectiva-website`
 * re-implements the same check on its side.
 *
 * Returns `false` (rather than throwing) on any malformed input so
 * callers can treat verification failure uniformly.
 */
export function verifyWebhookSignature(
  body: string,
  secret: string,
  headerSignature: string | undefined,
  headerTimestamp: string | undefined,
  now: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!headerSignature || !headerTimestamp) return false;
  if (!headerSignature.startsWith(SIGNATURE_PREFIX)) return false;

  const ts = Number(headerTimestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) return false;

  const expectedHex = createHmac("sha256", secret)
    .update(`${headerTimestamp}.${body}`)
    .digest("hex");
  const receivedHex = headerSignature.slice(SIGNATURE_PREFIX.length);

  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
