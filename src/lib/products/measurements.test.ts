import { describe, expect, it } from "vitest";

import {
  doubledMeasurements,
  flatMeasurements,
  measurementToColumn,
  type ProductMeasurements,
} from "./measurements";

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

describe("measurementToColumn", () => {
  it("maps shoulder → shoulderCm", () => {
    expect(measurementToColumn("shoulder")).toBe("shoulderCm");
  });

  it("maps chest → chestCm", () => {
    expect(measurementToColumn("chest")).toBe("chestCm");
  });

  it("braSize maps to itself", () => {
    expect(measurementToColumn("braSize")).toBe("braSize");
  });
});

describe("flatMeasurements", () => {
  it("returns a shallow copy of the input", () => {
    const input = { ...blank, chestCm: 44 };
    const out = flatMeasurements(input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });
});

describe("doubledMeasurements", () => {
  it("returns the input unchanged when clothingType is null", () => {
    const input = { ...blank, chestCm: 44, waistCm: 38 };
    expect(doubledMeasurements(null, input)).toEqual(input);
  });

  it("for a shirt, doubles chest only", () => {
    const out = doubledMeasurements("shirt", {
      ...blank,
      shoulderCm: 42,
      chestCm: 44,
      lengthCm: 70,
    });
    expect(out.shoulderCm).toBe(42);
    expect(out.chestCm).toBe(88);
    expect(out.lengthCm).toBe(70);
  });

  it("for a jean, doubles waist + hip + leg, leaves rise + length", () => {
    const out = doubledMeasurements("jean", {
      ...blank,
      waistCm: 38,
      hipCm: 48,
      riseCm: 26,
      legCm: 75,
      lengthCm: 100,
    });
    expect(out.waistCm).toBe(76);
    expect(out.hipCm).toBe(96);
    expect(out.legCm).toBe(150);
    expect(out.riseCm).toBe(26);
    expect(out.lengthCm).toBe(100);
  });

  it("for a dress, doubles chest + waist + hip but not length", () => {
    const out = doubledMeasurements("dress", {
      ...blank,
      shoulderCm: 40,
      chestCm: 44,
      waistCm: 38,
      hipCm: 48,
      lengthCm: 120,
    });
    expect(out.shoulderCm).toBe(40);
    expect(out.chestCm).toBe(88);
    expect(out.waistCm).toBe(76);
    expect(out.hipCm).toBe(96);
    expect(out.lengthCm).toBe(120);
  });

  it("never doubles braSize for corset", () => {
    const out = doubledMeasurements("corset", {
      ...blank,
      chestCm: 44,
      lengthCm: 40,
      braSize: "90C",
    });
    expect(out.chestCm).toBe(88);
    expect(out.lengthCm).toBe(40);
    expect(out.braSize).toBe("90C");
  });

  it("bodysuit returns input unchanged", () => {
    const input = { ...blank, chestCm: 44 };
    expect(doubledMeasurements("bodysuit", input)).toEqual(input);
  });

  it("skips nulls without crashing", () => {
    const out = doubledMeasurements("jean", { ...blank, waistCm: 38 });
    expect(out.waistCm).toBe(76);
    expect(out.hipCm).toBeNull();
    expect(out.legCm).toBeNull();
  });

  it("doubles waistMaxCm alongside waistCm when waist is x2", () => {
    const out = doubledMeasurements("jean", {
      ...blank,
      waistCm: 38,
      waistMaxCm: 44,
    });
    expect(out.waistCm).toBe(76);
    expect(out.waistMaxCm).toBe(88);
  });

  it("leaves waistMaxCm null when no max is set", () => {
    const out = doubledMeasurements("jean", { ...blank, waistCm: 38 });
    expect(out.waistMaxCm).toBeNull();
  });
});
