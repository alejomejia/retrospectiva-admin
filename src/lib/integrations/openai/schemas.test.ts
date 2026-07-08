import { describe, expect, it } from "vitest";

import { ETSY_ERA_VALUES } from "@/lib/products/draft-schema";

import { EnrichmentOutput } from "./schemas";

describe("EnrichmentOutput", () => {
  const validInput = {
    titleEn: "Blue 80s floral dress",
    descriptionEn:
      "An 80s dress in deep blue with a small floral print. Lightweight fabric, ideal for spring. Pair it with white boots for a retro look.",
    etsyTagsEn: ["dress", "vintage", "80s"],
    etsyMaterialsEn: ["cotton", "polyester"],
    etsyWhenMade: "1980s" as const,
    etsyPrimaryColor: "blue" as const,
    etsySecondaryColor: null,
  };

  it("accepts a well-formed enrichment payload", () => {
    expect(EnrichmentOutput.safeParse(validInput).success).toBe(true);
  });

  it("rejects titles below 10 chars or above 140", () => {
    expect(
      EnrichmentOutput.safeParse({ ...validInput, titleEn: "Dress" })
        .success,
    ).toBe(false);
    expect(
      EnrichmentOutput.safeParse({
        ...validInput,
        titleEn: "x".repeat(141),
      }).success,
    ).toBe(false);
  });

  it("rejects descriptions under 40 chars", () => {
    expect(
      EnrichmentOutput.safeParse({
        ...validInput,
        descriptionEn: "too short",
      }).success,
    ).toBe(false);
  });

  it("rejects more than 13 tags", () => {
    expect(
      EnrichmentOutput.safeParse({
        ...validInput,
        etsyTagsEn: Array(14).fill("tag"),
      }).success,
    ).toBe(false);
  });

  it("rejects tags longer than 30 chars", () => {
    expect(
      EnrichmentOutput.safeParse({
        ...validInput,
        etsyTagsEn: ["x".repeat(31)],
      }).success,
    ).toBe(false);
  });

  it("rejects materials longer than 45 chars", () => {
    expect(
      EnrichmentOutput.safeParse({
        ...validInput,
        etsyMaterialsEn: ["x".repeat(46)],
      }).success,
    ).toBe(false);
  });

  it("only accepts known eras", () => {
    for (const era of ETSY_ERA_VALUES) {
      expect(
        EnrichmentOutput.safeParse({ ...validInput, etsyWhenMade: era })
          .success,
      ).toBe(true);
    }
    expect(
      EnrichmentOutput.safeParse({
        ...validInput,
        etsyWhenMade: "2020s" as never,
      }).success,
    ).toBe(false);
  });
});
