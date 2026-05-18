import { describe, expect, it } from "vitest";

import { clothingType } from "@/lib/db/schema";

import {
  CLOTHING_TYPES,
  doublesAtBoundary,
  getCategoryLabel,
  getClothingType,
  getClothingTypeLabel,
  getClothingTypesByCategory,
  getRequiredMeasurements,
} from "./clothing-types";

describe("CLOTHING_TYPES registry", () => {
  it("covers every clothing_type enum value exactly once", () => {
    const registryValues = CLOTHING_TYPES.map((e) => e.value).sort();
    const enumValues = [...clothingType.enumValues].sort();
    expect(registryValues).toEqual(enumValues);
  });

  it("getClothingType returns the entry by value", () => {
    expect(getClothingType("dress")?.category).toBe("complete");
    expect(getClothingType("jean")?.category).toBe("lower");
  });

  it("getClothingTypeLabel reads from i18n", () => {
    expect(getClothingTypeLabel("dress")).toBe("Vestido");
  });

  it("getClothingTypeLabel falls back to the raw value when missing", () => {
    expect(getClothingTypeLabel("skirt")).toBe("Falda");
  });

  it("groups by category", () => {
    const upper = getClothingTypesByCategory("upper").map((e) => e.value);
    expect(upper).toEqual(
      expect.arrayContaining(["shirt", "vest", "top", "sweater", "jacket", "trench_coat"]),
    );
    expect(getClothingTypesByCategory("special").map((e) => e.value)).toEqual([
      "corset",
    ]);
  });

  it("returns Spanish category labels", () => {
    expect(getCategoryLabel("upper")).toBe("Parte superior");
    expect(getCategoryLabel("complete")).toBe("Conjunto completo");
  });
});

describe("required measurements", () => {
  it("shirt has shoulder, chest, length", () => {
    expect(getRequiredMeasurements("shirt")).toEqual([
      "shoulder",
      "chest",
      "length",
    ]);
  });

  it("skirt has waist, hip, length (no leg)", () => {
    expect(getRequiredMeasurements("skirt")).toEqual(["waist", "hip", "length"]);
  });

  it("jean has all five lower-body measurements", () => {
    expect(getRequiredMeasurements("jean")).toEqual([
      "waist",
      "hip",
      "rise",
      "leg",
      "length",
    ]);
  });

  it("dress has shoulder, chest, waist, hip, length (no rise, no leg)", () => {
    expect(getRequiredMeasurements("dress")).toEqual([
      "shoulder",
      "chest",
      "waist",
      "hip",
      "length",
    ]);
  });

  it("corset includes braSize", () => {
    expect(getRequiredMeasurements("corset")).toContain("braSize");
  });

  it("bodysuit has zero measurements", () => {
    expect(getRequiredMeasurements("bodysuit")).toEqual([]);
  });
});

describe("doublesAtBoundary", () => {
  it("shirt doubles only chest", () => {
    expect(doublesAtBoundary("shirt", "chest")).toBe(true);
    expect(doublesAtBoundary("shirt", "shoulder")).toBe(false);
    expect(doublesAtBoundary("shirt", "length")).toBe(false);
  });

  it("jean doubles waist, hip, leg", () => {
    expect(doublesAtBoundary("jean", "waist")).toBe(true);
    expect(doublesAtBoundary("jean", "hip")).toBe(true);
    expect(doublesAtBoundary("jean", "leg")).toBe(true);
    expect(doublesAtBoundary("jean", "rise")).toBe(false);
    expect(doublesAtBoundary("jean", "length")).toBe(false);
  });

  it("dress doubles chest, waist, hip — but never length", () => {
    expect(doublesAtBoundary("dress", "chest")).toBe(true);
    expect(doublesAtBoundary("dress", "waist")).toBe(true);
    expect(doublesAtBoundary("dress", "hip")).toBe(true);
    expect(doublesAtBoundary("dress", "length")).toBe(false);
  });

  it("never doubles bra size", () => {
    expect(doublesAtBoundary("corset", "braSize")).toBe(false);
  });

  it("bodysuit doubles nothing", () => {
    expect(doublesAtBoundary("bodysuit", "chest")).toBe(false);
  });
});
