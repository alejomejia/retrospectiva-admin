import { describe, expect, it } from "vitest";

import type { Product } from "@/lib/db/schema";

import {
  formatEurFromCents,
  storyEyebrow,
  storyPriceCents,
  storyPriceLabel,
} from "./instagram-story";

const eyebrowProduct = (
  etsyWhenMade: string | null,
  size: string | null,
): Pick<Product, "etsyWhenMade" | "size"> => ({ etsyWhenMade, size });

describe("storyEyebrow", () => {
  it("joins era and the full size conversion with dots", () => {
    expect(storyEyebrow(eyebrowProduct("1980s", "S"))).toBe(
      "1980S · S · EU 36 · UK 8 · US 4",
    );
  });

  it("formats the before_1950 era token", () => {
    expect(storyEyebrow(eyebrowProduct("before_1950", "M"))).toBe(
      "BEFORE 1950 · M · EU 40 · UK 12 · US 8",
    );
  });

  it("omits the size segment when size is missing/unrecognized", () => {
    expect(storyEyebrow(eyebrowProduct("1970s", null))).toBe("1970S");
    expect(storyEyebrow(eyebrowProduct("1970s", "not-a-size"))).toBe("1970S");
  });

  it("omits the era segment when absent", () => {
    expect(storyEyebrow(eyebrowProduct(null, "L"))).toBe(
      "L · EU 44 · UK 16 · US 12",
    );
    expect(storyEyebrow(eyebrowProduct("", "L"))).toBe(
      "L · EU 44 · UK 16 · US 12",
    );
  });

  it("returns null when both segments are absent", () => {
    expect(storyEyebrow(eyebrowProduct(null, null))).toBeNull();
  });
});

type PriceFields = Pick<
  Product,
  | "basePriceCents"
  | "markupPercentOverride"
  | "listPriceCentsOverride"
  | "discountPercent"
>;

const priceProduct = (overrides: Partial<PriceFields>): PriceFields => ({
  basePriceCents: null,
  markupPercentOverride: null,
  listPriceCentsOverride: null,
  discountPercent: null,
  ...overrides,
});

describe("storyPriceCents", () => {
  it("returns null when there is no decided price", () => {
    expect(storyPriceCents(priceProduct({}), 30)).toBeNull();
  });

  it("charm-rounds the marked-up list price with no promotion", () => {
    // 10000 * 1.30 = 13000 → charm 13099
    expect(storyPriceCents(priceProduct({ basePriceCents: 10_000 }), 30)).toBe(
      13_099,
    );
  });

  it("applies an active promotion to the inflated listing price", () => {
    // list 13000 → inflated charm 17399 → 25% off → round(13049.25) = 13049
    expect(
      storyPriceCents(
        priceProduct({ basePriceCents: 10_000, discountPercent: 25 }),
        30,
      ),
    ).toBe(13_049);
  });

  it("ignores a zero/empty discount", () => {
    expect(
      storyPriceCents(
        priceProduct({ basePriceCents: 10_000, discountPercent: 0 }),
        30,
      ),
    ).toBe(13_099);
  });

  it("honours an absolute list-price override", () => {
    expect(
      storyPriceCents(priceProduct({ listPriceCentsOverride: 4_800 }), 30),
    ).toBe(4_899);
  });
});

describe("formatEurFromCents", () => {
  it("renders charm prices with cents", () => {
    expect(formatEurFromCents(4_799)).toBe("€47.99");
  });

  it("drops .00 for whole euros", () => {
    expect(formatEurFromCents(4_800)).toBe("€48");
  });
});

describe("storyPriceLabel", () => {
  it("returns null for an undecided price", () => {
    expect(storyPriceLabel(priceProduct({}), 30)).toBeNull();
  });

  it("formats the charm price", () => {
    expect(
      storyPriceLabel(priceProduct({ listPriceCentsOverride: 4_800 }), 30),
    ).toBe("€48.99");
  });
});
