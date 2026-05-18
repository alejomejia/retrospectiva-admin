import { describe, expect, it } from "vitest";

import {
  DEFAULT_MARKUP_PERCENT,
  effectiveListCents,
  effectiveMarkupPercent,
} from "./pricing";

describe("effectiveListCents", () => {
  it("returns null when base and override are both unset", () => {
    expect(
      effectiveListCents({ basePriceCents: null, shopMarkupPercent: 30 }),
    ).toBeNull();
  });

  it("applies shop markup by default (30% on €100)", () => {
    expect(
      effectiveListCents({ basePriceCents: 10_000, shopMarkupPercent: 30 }),
    ).toBe(13_000);
  });

  it("applies the per-product markup override when set", () => {
    expect(
      effectiveListCents({
        basePriceCents: 10_000,
        markupPercentOverride: 50,
        shopMarkupPercent: 30,
      }),
    ).toBe(15_000);
  });

  it("absolute override wins over markup math", () => {
    expect(
      effectiveListCents({
        basePriceCents: 10_000,
        markupPercentOverride: 50,
        listPriceCentsOverride: 9_999,
        shopMarkupPercent: 30,
      }),
    ).toBe(9_999);
  });

  it("absolute override is honored even when base is null", () => {
    expect(
      effectiveListCents({
        basePriceCents: null,
        listPriceCentsOverride: 5_500,
        shopMarkupPercent: 30,
      }),
    ).toBe(5_500);
  });

  it("rounds to the nearest cent", () => {
    // €33.33 base, 30% markup = 4332.9 cents → 4333.
    expect(
      effectiveListCents({ basePriceCents: 3_333, shopMarkupPercent: 30 }),
    ).toBe(4_333);
  });

  it("treats markup 0 as no markup", () => {
    expect(
      effectiveListCents({ basePriceCents: 10_000, shopMarkupPercent: 0 }),
    ).toBe(10_000);
  });
});

describe("effectiveMarkupPercent", () => {
  it("returns the override when set", () => {
    expect(
      effectiveMarkupPercent({
        markupPercentOverride: 42,
        shopMarkupPercent: 30,
      }),
    ).toBe(42);
  });

  it("returns the shop value when no override", () => {
    expect(effectiveMarkupPercent({ shopMarkupPercent: 25 })).toBe(25);
  });

  it("returns null when an absolute list-price override is in play", () => {
    expect(
      effectiveMarkupPercent({
        listPriceCentsOverride: 9_999,
        shopMarkupPercent: 30,
      }),
    ).toBeNull();
  });

  it("defaults to DEFAULT_MARKUP_PERCENT when shop value is missing", () => {
    expect(
      effectiveMarkupPercent({
        shopMarkupPercent: undefined as unknown as number,
      }),
    ).toBe(DEFAULT_MARKUP_PERCENT);
  });
});
