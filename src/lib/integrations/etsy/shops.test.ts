import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/test/msw-server";

import {
  fetchShopByOwnerUserId,
  parseUserIdFromAccessToken,
} from "./shops";

describe("parseUserIdFromAccessToken", () => {
  it("extracts the numeric user_id prefix", () => {
    expect(parseUserIdFromAccessToken("12345678.abc.def")).toBe(12345678);
  });

  it("works with a single dot", () => {
    expect(parseUserIdFromAccessToken("777.token")).toBe(777);
  });

  it("throws on missing numeric prefix", () => {
    expect(() => parseUserIdFromAccessToken("not-a-number.token")).toThrow();
    expect(() => parseUserIdFromAccessToken("")).toThrow();
    expect(() => parseUserIdFromAccessToken("0.token")).toThrow();
  });
});

describe("fetchShopByOwnerUserId", () => {
  it("hits /users/{userId}/shops with both required headers", async () => {
    let capturedAuth: string | null = null;
    let capturedApiKey: string | null = null;

    server.use(
      http.get(
        "https://openapi.etsy.com/v3/application/users/42/shops",
        ({ request }) => {
          capturedAuth = request.headers.get("authorization");
          capturedApiKey = request.headers.get("x-api-key");
          return HttpResponse.json({
            shop_id: 999,
            shop_name: "Retrospectiva",
            user_id: 42,
            currency_code: "EUR",
          });
        },
      ),
    );

    const shop = await fetchShopByOwnerUserId(42, "access-token-abc");
    expect(shop).toEqual({
      shop_id: 999,
      shop_name: "Retrospectiva",
      user_id: 42,
      currency_code: "EUR",
    });
    expect(capturedAuth).toBe("Bearer access-token-abc");
    expect(capturedApiKey).toBe("test-etsy-client:test-etsy-secret");
  });

  it("throws on non-2xx responses", async () => {
    server.use(
      http.get(
        "https://openapi.etsy.com/v3/application/users/42/shops",
        () => HttpResponse.json({ error: "no shop" }, { status: 404 }),
      ),
    );
    await expect(fetchShopByOwnerUserId(42, "any")).rejects.toThrow(/404/);
  });
});
