// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { applyListingProperties } from "./listing-properties";
import type { TaxonomyProperty } from "./listings";

function colorProperty(name: string, displayName: string): TaxonomyProperty {
  return {
    property_id: name === "primary_color" ? 200 : 52047899002,
    name,
    display_name: displayName,
    scales: [],
    is_required: false,
    supports_attributes: true,
    supports_variations: true,
    possible_values: [
      { value_id: 1, name: "Black" },
      { value_id: 2, name: "Blue" },
      { value_id: 3, name: "Red" },
    ],
  };
}

function sizeProperty(): TaxonomyProperty {
  return {
    property_id: 100,
    name: "size",
    display_name: "Size",
    scales: [
      { scale_id: 11, display_name: "Men's" },
      { scale_id: 22, display_name: "Women's US Letter" },
    ],
    is_required: false,
    supports_attributes: true,
    supports_variations: true,
    possible_values: [
      { value_id: 91, name: "S", scale_id: 22 },
      { value_id: 92, name: "M", scale_id: 22 },
      { value_id: 81, name: "S", scale_id: 11 },
    ],
  };
}

function makeDeps(properties: TaxonomyProperty[]) {
  const updates: Array<{
    propertyId: number;
    values: string[];
    valueIds: number[];
    scaleId?: number;
  }> = [];
  return {
    updates,
    deps: {
      getProperties: vi.fn(async () => properties),
      updateProperty: vi.fn(
        async (
          _shop: number,
          _listing: number,
          propertyId: number,
          input: { values: string[]; valueIds: number[]; scaleId?: number },
        ) => {
          updates.push({ propertyId, ...input });
        },
      ),
      warn: vi.fn(),
    },
  };
}

describe("applyListingProperties", () => {
  it("maps color name (case-insensitive) to its value_id", async () => {
    const { updates, deps } = makeDeps([
      colorProperty("primary_color", "Primary color"),
    ]);
    const applied = await applyListingProperties(
      7,
      42,
      123,
      { primaryColor: "blue" },
      deps,
    );
    expect(applied).toEqual(["primaryColor"]);
    expect(updates).toEqual([
      { propertyId: 200, values: ["Blue"], valueIds: [2] },
    ]);
  });

  it("picks the women's scale and the value scoped to it for size", async () => {
    const { updates, deps } = makeDeps([sizeProperty()]);
    const applied = await applyListingProperties(
      7,
      42,
      123,
      { size: "S" },
      deps,
    );
    expect(applied).toEqual(["size"]);
    expect(updates).toEqual([
      { propertyId: 100, values: ["S"], valueIds: [91], scaleId: 22 },
    ]);
  });

  it("skips (and warns) when the value isn't in the Etsy vocab", async () => {
    const { updates, deps } = makeDeps([
      colorProperty("primary_color", "Primary color"),
    ]);
    const applied = await applyListingProperties(
      7,
      42,
      123,
      { primaryColor: "chartreuse" },
      deps,
    );
    expect(applied).toEqual([]);
    expect(updates).toHaveLength(0);
    expect(deps.warn).toHaveBeenCalled();
  });

  it("never throws when the taxonomy lookup fails", async () => {
    const deps = {
      getProperties: vi.fn(async () => {
        throw new Error("etsy down");
      }),
      updateProperty: vi.fn(),
      warn: vi.fn(),
    };
    const applied = await applyListingProperties(
      7,
      42,
      123,
      { primaryColor: "blue", size: "S" },
      deps,
    );
    expect(applied).toEqual([]);
    expect(deps.updateProperty).not.toHaveBeenCalled();
  });

  it("applies primary, secondary, and size independently", async () => {
    const { updates, deps } = makeDeps([
      colorProperty("primary_color", "Primary color"),
      colorProperty("secondary_color", "Secondary color"),
      sizeProperty(),
    ]);
    const applied = await applyListingProperties(
      7,
      42,
      123,
      { primaryColor: "black", secondaryColor: "red", size: "M" },
      deps,
    );
    expect(applied).toEqual(["primaryColor", "secondaryColor", "size"]);
    expect(updates).toHaveLength(3);
  });
});
