import { signWebhook } from "./sign";

import type { WebsitePayload } from "./payload-mapper";

/**
 * POSTs a signed webhook to the public `retrospectiva-website`
 * revalidation endpoint. The consumer verifies the HMAC and
 * timestamp window before acting (see `./sign.ts`).
 *
 * Read env directly: this module is imported by the BullMQ worker,
 * which can't load `@/lib/utils/config` (`server-only`). See
 * `docs/project-conventions.md` §1.
 *
 * Throws on:
 *   - Missing `WEBSITE_WEBHOOK_URL` / `WEBSITE_WEBHOOK_SECRET`.
 *   - Network failure / abort.
 *   - Non-2xx response (the body is included in the error message
 *     for debugging, truncated to 500 chars).
 */

const REQUEST_TIMEOUT_MS = 10_000;

export type SendResult = {
  status: number;
  url: string;
};

export class WebsiteWebhookHttpError extends Error {
  override name = "WebsiteWebhookHttpError";
  status: number;
  bodySnippet: string;
  constructor(status: number, bodySnippet: string) {
    super(`website webhook failed: HTTP ${status} :: ${bodySnippet}`);
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export async function sendWebsiteWebhook(
  payload: WebsitePayload,
): Promise<SendResult> {
  const url = requireEnv("WEBSITE_WEBHOOK_URL");
  const secret = requireEnv("WEBSITE_WEBHOOK_SECRET");

  const body = JSON.stringify(payload);
  const signed = signWebhook(body, secret);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...signed,
      },
      body,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    const snippet = raw.slice(0, 500);
    throw new WebsiteWebhookHttpError(res.status, snippet);
  }
  return { status: res.status, url };
}
