import { describe, expect, it } from "vitest";

import type { Product } from "@/lib/db/schema";

import {
  STORY_FIELDS,
  defaultStoryFields,
  parseFieldOverrides,
  resolveStoryFields,
} from "./instagram-story-fields";

/** Minimal product row covering the fields the defaults read. */
const product = (overrides: Partial<Product> = {}): Product =>
  ({
    titleEn: "Wool Coat",
    titleEs: "Abrigo de lana",
    etsyWhenMade: "1980s",
    size: "S",
    basePriceCents: 10_000,
    markupPercentOverride: null,
    listPriceCentsOverride: null,
    discountPercent: null,
    ...overrides,
  }) as Product;

describe("defaultStoryFields", () => {
  it("computes the full 'new' field set from the product", () => {
    expect(defaultStoryFields("new", product(), 30)).toEqual({
      badge: "New today",
      eyebrow: "1980S · S · EU 36 · UK 8 · US 4",
      title: "Wool Coat",
      price: "€130.99",
      footerTagline: "One of a kind",
    });
  });

  it("computes the 'sold' field set (accent, no price/eyebrow)", () => {
    expect(defaultStoryFields("sold", product(), 30)).toEqual({
      accent: "Gone",
      title: "Wool Coat",
      footerTagline: "One of a kind",
      country: "",
    });
  });

  it("prefers the English title, falling back to Spanish", () => {
    expect(defaultStoryFields("new", product({ titleEn: null }), 30).title).toBe(
      "Abrigo de lana",
    );
  });

  it("blanks nullable slots when their source is absent", () => {
    const fields = defaultStoryFields(
      "new",
      product({ etsyWhenMade: null, size: null, basePriceCents: null }),
      30,
    );
    expect(fields.eyebrow).toBe("");
    expect(fields.price).toBe("");
  });
});

describe("parseFieldOverrides", () => {
  it("reads only known keys for the variant", () => {
    const params = new URLSearchParams({
      title: "Custom",
      accent: "ignored-for-new",
      unknown: "x",
    });
    expect(parseFieldOverrides(params, "new")).toEqual({ title: "Custom" });
  });

  it("treats a present-but-empty param as an intentional clear", () => {
    const params = new URLSearchParams("eyebrow=");
    expect(parseFieldOverrides(params, "new")).toEqual({ eyebrow: "" });
  });

  it("omits absent params so the default can win", () => {
    expect(parseFieldOverrides(new URLSearchParams(), "new")).toEqual({});
  });

  it("clamps an over-long override", () => {
    const long = "a".repeat(500);
    expect(parseFieldOverrides(new URLSearchParams({ title: long }), "new").title)
      .toHaveLength(200);
  });
});

describe("resolveStoryFields", () => {
  it("overlays overrides on the product-derived defaults", () => {
    const params = new URLSearchParams({ title: "Edited", eyebrow: "" });
    const fields = resolveStoryFields("new", product(), 30, params);
    expect(fields.title).toBe("Edited");
    expect(fields.eyebrow).toBe("");
    // Untouched slots keep their defaults.
    expect(fields.badge).toBe("New today");
    expect(fields.price).toBe("€130.99");
  });
});

describe("STORY_FIELDS", () => {
  it("marks eyebrow and price nullable for 'new'", () => {
    const byKey = Object.fromEntries(STORY_FIELDS.new.map((f) => [f.key, f]));
    expect(byKey.eyebrow?.nullable).toBe(true);
    expect(byKey.price?.nullable).toBe(true);
    expect(byKey.title?.multiline).toBe(true);
  });
});
