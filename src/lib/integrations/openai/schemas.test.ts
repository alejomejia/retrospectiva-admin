import { describe, expect, it } from "vitest";

import { ETSY_ERA_VALUES } from "@/lib/products/draft-schema";

import { EnrichmentOutput } from "./schemas";

describe("EnrichmentOutput", () => {
  const validInput = {
    titleEs: "Vestido azul de los 80 con flores",
    descriptionEs:
      "Un vestido de los 80 en azul intenso con un estampado floral pequeño. Tela ligera, ideal para primavera. Combínalo con botas blancas para un look retro.",
    etsyTagsEs: ["vestido", "vintage", "anos 80"],
    etsyMaterialsEs: ["algodon", "poliester"],
    etsyWhenMade: "1980s" as const,
    etsyPrimaryColor: "blue" as const,
    etsySecondaryColor: null,
  };

  it("accepts a well-formed enrichment payload", () => {
    expect(EnrichmentOutput.safeParse(validInput).success).toBe(true);
  });

  it("rejects titles below 10 chars or above 140", () => {
    expect(
      EnrichmentOutput.safeParse({ ...validInput, titleEs: "Vestido" })
        .success,
    ).toBe(false);
    expect(
      EnrichmentOutput.safeParse({
        ...validInput,
        titleEs: "x".repeat(141),
      }).success,
    ).toBe(false);
  });

  it("rejects descriptions under 40 chars", () => {
    expect(
      EnrichmentOutput.safeParse({
        ...validInput,
        descriptionEs: "demasiado corta",
      }).success,
    ).toBe(false);
  });

  it("rejects more than 13 tags", () => {
    expect(
      EnrichmentOutput.safeParse({
        ...validInput,
        etsyTagsEs: Array(14).fill("tag"),
      }).success,
    ).toBe(false);
  });

  it("rejects tags longer than 30 chars", () => {
    expect(
      EnrichmentOutput.safeParse({
        ...validInput,
        etsyTagsEs: ["x".repeat(31)],
      }).success,
    ).toBe(false);
  });

  it("rejects materials longer than 45 chars", () => {
    expect(
      EnrichmentOutput.safeParse({
        ...validInput,
        etsyMaterialsEs: ["x".repeat(46)],
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
