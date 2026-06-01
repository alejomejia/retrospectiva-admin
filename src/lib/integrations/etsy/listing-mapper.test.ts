// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { Product } from "@/lib/db/schema";

import {
  ListingMapperError,
  mapProductToCreateDraftPayload,
  type ShopPublishConfig,
} from "./listing-mapper";

const SHOP: ShopPublishConfig = {
  shopId: 12345,
  returnPolicyId: 9001,
  readinessStateId: 4242,
  markupPercent: 30,
};

function makeProduct(overrides: Partial<Product> = {}): Product {
  const base: Partial<Product> = {
    id: "p1",
    titleEs: "Vestido azul vintage",
    titleEn: "Vintage blue dress",
    descriptionEs: "Hermoso vestido.",
    descriptionEn: "Beautiful dress.",
    basePriceCents: 10000,
    currency: "EUR",
    markupPercentOverride: null,
    listPriceCentsOverride: null,
    buyPriceCents: null,
    clothingType: "dress",
    condition: "perfect",
    size: "M",
    isFeatured: false,
    etsyPrimaryColor: null,
    etsySecondaryColor: null,
    shoulderCm: null,
    chestCm: null,
    waistCm: null,
    hipCm: null,
    riseCm: null,
    legCm: null,
    lengthCm: null,
    braSize: null,
    etsyTagsEs: ["azul", "vestido"],
    etsyTagsEn: ["blue", "dress"],
    etsyMaterialsEs: ["algodón"],
    etsyMaterialsEn: ["cotton"],
    etsyWhenMade: "1990s",
    etsyTaxonomyId: 11074,
    shippingProfileId: 5001,
    aiImageEnabled: null,
    aiModelId: null,
    aiSourcePanel: null,
    aiPosePreset: "soft_relaxed",
    aiFramingPreset: "waist_up",
    aiEnvironmentPreset: "textured_wall",
    aiFitOverride: null,
    aiImageQuality: "low",
    status: "draft",
    scheduledPublishAt: null,
    etsyListingId: null,
    etsyState: null,
    soldAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, ...overrides } as Product;
}

describe("mapProductToCreateDraftPayload", () => {
  it("produces the canonical payload for a fully-populated product", () => {
    const payload = mapProductToCreateDraftPayload({
      product: makeProduct(),
      shop: SHOP,
    });
    expect(payload).toMatchObject({
      quantity: 1,
      title: "Vintage blue dress",
      description: "Beautiful dress.",
      // 100.00 EUR * 1.30 = 130.00 → charm-priced to 130.99
      price: 130.99,
      who_made: "someone_else",
      when_made: "1990s",
      taxonomy_id: 11074,
      shipping_profile_id: 5001,
      return_policy_id: 9001,
      readiness_state_id: 4242,
      tags: ["blue", "dress"],
      materials: ["cotton"],
      type: "physical",
      is_supply: false,
      is_personalizable: false,
      is_taxable: true,
      should_auto_renew: true,
    });
  });

  it("honors per-product markup override", () => {
    const payload = mapProductToCreateDraftPayload({
      product: makeProduct({ markupPercentOverride: 50 }),
      shop: SHOP,
    });
    expect(payload.price).toBe(150.99);
  });

  it("honors absolute list-price override over markup math (then charm-rounds)", () => {
    const payload = mapProductToCreateDraftPayload({
      product: makeProduct({ listPriceCentsOverride: 8888 }),
      shop: SHOP,
    });
    expect(payload.price).toBe(88.99);
  });

  it("inflates the price when a discount is set", () => {
    // 100.00 * 1.30 = 130.00 → 130 / 0.75 = 173.33 → charm 173.99
    const payload = mapProductToCreateDraftPayload({
      product: makeProduct({ discountPercent: 25 }),
      shop: SHOP,
    });
    expect(payload.price).toBe(173.99);
  });

  it("ignores a zero discount (plain charm price)", () => {
    const payload = mapProductToCreateDraftPayload({
      product: makeProduct({ discountPercent: 0 }),
      shop: SHOP,
    });
    expect(payload.price).toBe(130.99);
  });

  it("rejects missing titleEn", () => {
    expect(() =>
      mapProductToCreateDraftPayload({
        product: makeProduct({ titleEn: null }),
        shop: SHOP,
      }),
    ).toThrow(ListingMapperError);
  });

  it("rejects oversized title", () => {
    expect(() =>
      mapProductToCreateDraftPayload({
        product: makeProduct({ titleEn: "x".repeat(141) }),
        shop: SHOP,
      }),
    ).toThrow(/titleEn exceeds/);
  });

  it("rejects missing descriptionEn", () => {
    expect(() =>
      mapProductToCreateDraftPayload({
        product: makeProduct({ descriptionEn: "" }),
        shop: SHOP,
      }),
    ).toThrow(/descriptionEn/);
  });

  it("rejects missing taxonomy", () => {
    expect(() =>
      mapProductToCreateDraftPayload({
        product: makeProduct({ etsyTaxonomyId: null }),
        shop: SHOP,
      }),
    ).toThrow(/etsyTaxonomyId/);
  });

  it("rejects missing when_made", () => {
    expect(() =>
      mapProductToCreateDraftPayload({
        product: makeProduct({ etsyWhenMade: null }),
        shop: SHOP,
      }),
    ).toThrow(/etsyWhenMade/);
  });

  it("rejects out-of-vocab when_made", () => {
    expect(() =>
      mapProductToCreateDraftPayload({
        product: makeProduct({ etsyWhenMade: "2030s" }),
        shop: SHOP,
      }),
    ).toThrow(/not a valid Etsy when_made/);
  });

  it("rejects missing basePriceCents", () => {
    expect(() =>
      mapProductToCreateDraftPayload({
        product: makeProduct({ basePriceCents: null }),
        shop: SHOP,
      }),
    ).toThrow(/basePriceCents/);
  });

  it("trims tags + materials to Etsy caps and skips overlong entries", () => {
    const tooMany = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    const tooLongTag = "x".repeat(21);
    const payload = mapProductToCreateDraftPayload({
      product: makeProduct({
        etsyTagsEn: [...tooMany, tooLongTag, "  "],
        etsyMaterialsEn: ["wool", "x".repeat(46), "silk"],
      }),
      shop: SHOP,
    });
    expect(payload.tags).toHaveLength(13);
    expect(payload.tags).not.toContain(tooLongTag);
    expect(payload.materials).toEqual(["wool", "silk"]);
  });

  it("omits shipping/return when not configured", () => {
    const payload = mapProductToCreateDraftPayload({
      product: makeProduct({ shippingProfileId: null }),
      shop: { ...SHOP, returnPolicyId: null },
    });
    expect(payload.shipping_profile_id).toBeUndefined();
    expect(payload.return_policy_id).toBeUndefined();
  });

  it("rejects missing readinessStateId", () => {
    expect(() =>
      mapProductToCreateDraftPayload({
        product: makeProduct(),
        shop: { ...SHOP, readinessStateId: null },
      }),
    ).toThrow(/readinessStateId/);
  });
});
