import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/test/msw-server";

import type { EtsyOAuthRow, TokenStore } from "./client";
import {
  listReturnPolicies,
  listShippingProfiles,
  listShopSections,
} from "./shop-config";

const SHOP_ID = 42;
const API_BASE = "https://openapi.etsy.com/v3/application";

/**
 * Static, never-near-expiry row + a no-op update. The shop-config
 * helpers only ever read; refresh is exercised elsewhere.
 */
function staticStore(): TokenStore {
  const row: EtsyOAuthRow = {
    id: "row-test",
    shopId: SHOP_ID,
    accessToken: "at-test",
    refreshToken: "rt-test",
    scopes: "listings_r shops_r",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    defaultShippingProfileId: null,
    defaultReturnPolicyId: null,
    markupPercent: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return {
    read: async () => row,
    update: async () => row,
  };
}

describe("listShippingProfiles", () => {
  it("hits /shops/{shopId}/shipping-profiles and unwraps results[]", async () => {
    server.use(
      http.get(`${API_BASE}/shops/${SHOP_ID}/shipping-profiles`, () =>
        HttpResponse.json({
          count: 2,
          results: [
            { shipping_profile_id: 5001, title: "Standard EU" },
            { shipping_profile_id: 5002, title: "Heavy items" },
          ],
        }),
      ),
    );

    const profiles = await listShippingProfiles(SHOP_ID, staticStore());
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toMatchObject({
      shipping_profile_id: 5001,
      title: "Standard EU",
    });
  });

  it("returns an empty array when Etsy responds with no results", async () => {
    server.use(
      http.get(`${API_BASE}/shops/${SHOP_ID}/shipping-profiles`, () =>
        HttpResponse.json({ count: 0, results: [] }),
      ),
    );
    expect(await listShippingProfiles(SHOP_ID, staticStore())).toEqual([]);
  });

  it("throws on non-2xx responses", async () => {
    server.use(
      http.get(`${API_BASE}/shops/${SHOP_ID}/shipping-profiles`, () =>
        HttpResponse.json({ error: "Forbidden" }, { status: 403 }),
      ),
    );
    await expect(
      listShippingProfiles(SHOP_ID, staticStore()),
    ).rejects.toThrow(/403/);
  });
});

describe("listReturnPolicies", () => {
  it("hits /shops/{shopId}/policies/return and unwraps results[]", async () => {
    server.use(
      http.get(`${API_BASE}/shops/${SHOP_ID}/policies/return`, () =>
        HttpResponse.json({
          count: 1,
          results: [
            {
              return_policy_id: 7001,
              accepts_returns: true,
              accepts_exchanges: false,
              return_deadline: 30,
            },
          ],
        }),
      ),
    );

    const policies = await listReturnPolicies(SHOP_ID, staticStore());
    expect(policies).toHaveLength(1);
    expect(policies[0]?.return_policy_id).toBe(7001);
    expect(policies[0]?.accepts_returns).toBe(true);
  });
});

describe("listShopSections", () => {
  it("hits /shops/{shopId}/sections and unwraps results[]", async () => {
    server.use(
      http.get(`${API_BASE}/shops/${SHOP_ID}/sections`, () =>
        HttpResponse.json({
          count: 3,
          results: [
            { shop_section_id: 1, title: "Vestidos" },
            { shop_section_id: 2, title: "Abrigos" },
            { shop_section_id: 3, title: "Accesorios" },
          ],
        }),
      ),
    );

    const sections = await listShopSections(SHOP_ID, staticStore());
    expect(sections.map((s) => s.title)).toEqual([
      "Vestidos",
      "Abrigos",
      "Accesorios",
    ]);
  });
});
