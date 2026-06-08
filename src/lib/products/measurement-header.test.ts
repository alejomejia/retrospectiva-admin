import { describe, expect, it } from "vitest";

import {
  formatMeasurementBlock,
  prependMeasurementBlock,
} from "./measurement-header";
import { type ProductMeasurements } from "./measurements";

const blank: ProductMeasurements = {
  shoulderCm: null,
  sleeveWidthCm: null,
  sleeveLengthCm: null,
  chestCm: null,
  waistCm: null,
  waistMaxCm: null,
  hipCm: null,
  riseCm: null,
  legCm: null,
  lengthCm: null,
  braSize: null,
};

describe("formatMeasurementBlock", () => {
  it("renders a skirt (flat/around for doubled, single for length)", () => {
    const block = formatMeasurementBlock(
      "skirt",
      { ...blank, waistCm: 38, hipCm: 57.5, lengthCm: 80 },
      "es",
    );
    expect(block).toBe(
      [
        "Medidas:",
        "- Cintura: Plano 38cm - Contorno 76cm",
        "- Cadera: Plano 57.5cm - Contorno 115cm",
        "- Largo: 80cm",
      ].join("\n"),
    );
  });

  it("renders the same skirt in English", () => {
    const block = formatMeasurementBlock(
      "skirt",
      { ...blank, waistCm: 38, hipCm: 57.5, lengthCm: 80 },
      "en",
    );
    expect(block).toBe(
      [
        "Measurements:",
        "- Waist: Flat 38cm - Around 76cm",
        "- Hip: Flat 57.5cm - Around 115cm",
        "- Length: 80cm",
      ].join("\n"),
    );
  });

  it("splits an elastic waist into min/max lines", () => {
    const block = formatMeasurementBlock(
      "skirt",
      { ...blank, waistCm: 38, waistMaxCm: 42, lengthCm: 80 },
      "es",
    );
    expect(block).toBe(
      [
        "Medidas:",
        "- Cintura mínima: Plano 38cm - Contorno 76cm",
        "- Cintura máxima: Plano 42cm - Contorno 84cm",
        "- Largo: 80cm",
      ].join("\n"),
    );
  });

  it("only lists filled measurements", () => {
    const block = formatMeasurementBlock(
      "skirt",
      { ...blank, lengthCm: 80 },
      "es",
    );
    expect(block).toBe(["Medidas:", "- Largo: 80cm"].join("\n"));
  });

  it("renders measurements in registry order for an upper garment", () => {
    const block = formatMeasurementBlock(
      "shirt",
      { ...blank, shoulderCm: 40, sleeveWidthCm: 18, chestCm: 50, lengthCm: 70 },
      "es",
    );
    expect(block).toBe(
      [
        "Medidas:",
        "- Hombro: 40cm",
        "- Ancho de manga: Plano 18cm - Contorno 36cm",
        "- Pecho: Plano 50cm - Contorno 100cm",
        "- Largo: 70cm",
      ].join("\n"),
    );
  });

  it("renders bra size as a plain string (no cm, no doubling)", () => {
    const block = formatMeasurementBlock(
      "corset",
      { ...blank, chestCm: 44, lengthCm: 35, braSize: "34B" },
      "es",
    );
    expect(block).toBe(
      [
        "Medidas:",
        "- Pecho: Plano 44cm - Contorno 88cm",
        "- Largo: 35cm",
        "- Talla de copa: 34B",
      ].join("\n"),
    );
  });

  it("returns null when no measurements are filled", () => {
    expect(formatMeasurementBlock("skirt", blank, "es")).toBeNull();
  });

  it("returns null for a null clothing type", () => {
    expect(
      formatMeasurementBlock(null, { ...blank, waistCm: 38 }, "es"),
    ).toBeNull();
  });
});

describe("prependMeasurementBlock", () => {
  it("prepends the block above the body, separated by a blank line", () => {
    expect(
      prependMeasurementBlock(
        "A lovely skirt.",
        "skirt",
        { ...blank, waistCm: 38 },
        "es",
      ),
    ).toBe("Medidas:\n- Cintura: Plano 38cm - Contorno 76cm\n\nA lovely skirt.");
  });

  it("returns the body unchanged when there is nothing to render", () => {
    expect(prependMeasurementBlock("A lovely skirt.", "skirt", blank, "es")).toBe(
      "A lovely skirt.",
    );
  });

  it("returns the block alone when the body is empty", () => {
    expect(
      prependMeasurementBlock("", "skirt", { ...blank, waistCm: 38 }, "es"),
    ).toBe("Medidas:\n- Cintura: Plano 38cm - Contorno 76cm");
  });
});
