// @vitest-environment node
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/test/msw-server";

import {
  WebsiteWebhookHttpError,
  sendWebsiteWebhook,
} from "./client";
import {
  SIGNATURE_HEADER,
  SIGNATURE_PREFIX,
  TIMESTAMP_HEADER,
  verifyWebhookSignature,
} from "./sign";

import type { WebsitePayload } from "./payload-mapper";

function fakePayload(): WebsitePayload {
  return {
    productId: "prod-1",
    kind: "publish",
    emittedAt: "2026-05-10T00:00:00.000Z",
    status: "published",
    clothingType: "shirt",
    condition: "perfect",
    size: "M",
    featured: false,
    colors: { primary: null, secondary: null },
    title: { es: "X", en: "X" },
    description: { es: "Y", en: "Y" },
    tags: { es: [], en: [] },
    materials: { es: [], en: [] },
    era: null,
    basePriceCents: 1000,
    currency: "EUR",
    listPriceCents: 1300,
    discountPercent: null,
    compareAtPriceCents: null,
    measurements: {
      shoulderCm: null,
      sleeveWidthCm: null,
      sleeveLengthCm: null,
      chestCm: null,
      waistCm: null,
      hipCm: null,
      riseCm: null,
      legCm: null,
      lengthCm: null,
      braSize: null,
    },
    etsy: { listingId: 1, state: "active" },
    images: [],
    video: null,
    publishedAt: "2026-05-10T00:00:00.000Z",
    soldAt: null,
  };
}

describe("sendWebsiteWebhook", () => {
  it("POSTs JSON to WEBSITE_WEBHOOK_URL with signed headers", async () => {
    let captured: {
      contentType: string | null;
      signature: string | null;
      timestamp: string | null;
      bodyText: string;
    } | null = null;

    server.use(
      http.post(
        "https://retrospectiva.example/api/revalidate",
        async ({ request }) => {
          captured = {
            contentType: request.headers.get("content-type"),
            signature: request.headers.get(SIGNATURE_HEADER.toLowerCase()),
            timestamp: request.headers.get(TIMESTAMP_HEADER.toLowerCase()),
            bodyText: await request.text(),
          };
          return HttpResponse.json({ revalidated: true });
        },
      ),
    );

    const payload = fakePayload();
    const res = await sendWebsiteWebhook(payload);
    expect(res.status).toBe(200);
    expect(captured).not.toBeNull();
    const c = captured!;
    expect(c.contentType).toContain("application/json");
    expect(c.signature?.startsWith(SIGNATURE_PREFIX)).toBe(true);
    expect(c.timestamp).toMatch(/^\d+$/);
    expect(c.bodyText).toBe(JSON.stringify(payload));

    // Round-trip verify with same secret env var (vitest config).
    expect(
      verifyWebhookSignature(
        c.bodyText,
        process.env.WEBSITE_WEBHOOK_SECRET!,
        c.signature ?? undefined,
        c.timestamp ?? undefined,
      ),
    ).toBe(true);
  });

  it("throws WebsiteWebhookHttpError on non-2xx", async () => {
    server.use(
      http.post("https://retrospectiva.example/api/revalidate", () =>
        HttpResponse.text("nope", { status: 500 }),
      ),
    );
    await expect(sendWebsiteWebhook(fakePayload())).rejects.toBeInstanceOf(
      WebsiteWebhookHttpError,
    );
  });

  it("error carries status + truncated body snippet", async () => {
    const bigBody = "x".repeat(2000);
    server.use(
      http.post("https://retrospectiva.example/api/revalidate", () =>
        HttpResponse.text(bigBody, { status: 503 }),
      ),
    );
    await sendWebsiteWebhook(fakePayload()).catch((e: unknown) => {
      const err = e as WebsiteWebhookHttpError;
      expect(err.status).toBe(503);
      expect(err.bodySnippet.length).toBeLessThanOrEqual(500);
    });
  });
});
