import { describe, expect, it } from "vitest";

import { PANEL_ORDER } from "@/lib/integrations/openai/panel-keys";

import {
  AI_ENVIRONMENT_PRESETS,
  AI_FIT_OVERRIDES,
  AI_FRAMING_PRESETS,
  AI_POSE_PRESETS,
  ETSY_ERA_VALUES,
  ProductDraftPatchSchema,
  SIZE_VALUES,
} from "./draft-schema";

describe("ProductDraftPatchSchema", () => {
  it("accepts an empty patch (every field is optional)", () => {
    const r = ProductDraftPatchSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("accepts a partial patch with just one field", () => {
    const r = ProductDraftPatchSchema.safeParse({ basePriceCents: 1500 });
    expect(r.success).toBe(true);
  });

  it("accepts null to clear a nullable field", () => {
    const r = ProductDraftPatchSchema.safeParse({
      titleEs: null,
      basePriceCents: null,
      etsyTaxonomyId: null,
    });
    expect(r.success).toBe(true);
  });

  describe("titleEs / titleEn", () => {
    it("trims whitespace", () => {
      const r = ProductDraftPatchSchema.safeParse({ titleEs: "  hi  " });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.titleEs).toBe("hi");
    });

    it("rejects strings over 140 characters", () => {
      const r = ProductDraftPatchSchema.safeParse({
        titleEs: "x".repeat(141),
      });
      expect(r.success).toBe(false);
    });
  });

  describe("basePriceCents", () => {
    it("rejects negative", () => {
      const r = ProductDraftPatchSchema.safeParse({ basePriceCents: -1 });
      expect(r.success).toBe(false);
    });

    it("rejects non-integer", () => {
      const r = ProductDraftPatchSchema.safeParse({
        basePriceCents: 12.34,
      });
      expect(r.success).toBe(false);
    });

    it("accepts 0", () => {
      const r = ProductDraftPatchSchema.safeParse({ basePriceCents: 0 });
      expect(r.success).toBe(true);
    });
  });

  describe("markupPercentOverride", () => {
    it("rejects below 0", () => {
      const r = ProductDraftPatchSchema.safeParse({
        markupPercentOverride: -5,
      });
      expect(r.success).toBe(false);
    });

    it("rejects above 500", () => {
      const r = ProductDraftPatchSchema.safeParse({
        markupPercentOverride: 501,
      });
      expect(r.success).toBe(false);
    });

    it("accepts the boundary values", () => {
      expect(
        ProductDraftPatchSchema.safeParse({ markupPercentOverride: 0 })
          .success,
      ).toBe(true);
      expect(
        ProductDraftPatchSchema.safeParse({ markupPercentOverride: 500 })
          .success,
      ).toBe(true);
    });
  });

  describe("sizes", () => {
    it("accepts an empty array", () => {
      const r = ProductDraftPatchSchema.safeParse({ sizes: [] });
      expect(r.success).toBe(true);
    });

    it("accepts all known sizes including one_size", () => {
      const r = ProductDraftPatchSchema.safeParse({
        sizes: [...SIZE_VALUES],
      });
      expect(r.success).toBe(true);
    });

    it("rejects unknown size codes", () => {
      const r = ProductDraftPatchSchema.safeParse({
        sizes: ["xs", "huge" as never],
      });
      expect(r.success).toBe(false);
    });
  });

  describe("measurements (cm)", () => {
    it("rejects zero or below", () => {
      expect(
        ProductDraftPatchSchema.safeParse({ chestCm: 0 }).success,
      ).toBe(false);
      expect(
        ProductDraftPatchSchema.safeParse({ chestCm: -1 }).success,
      ).toBe(false);
    });

    it("rejects above 500", () => {
      expect(
        ProductDraftPatchSchema.safeParse({ chestCm: 501 }).success,
      ).toBe(false);
    });

    it("rejects non-integer", () => {
      expect(
        ProductDraftPatchSchema.safeParse({ chestCm: 44.5 }).success,
      ).toBe(false);
    });

    it("accepts 1 and 500", () => {
      expect(
        ProductDraftPatchSchema.safeParse({ chestCm: 1 }).success,
      ).toBe(true);
      expect(
        ProductDraftPatchSchema.safeParse({ chestCm: 500 }).success,
      ).toBe(true);
    });

    it("accepts null to clear", () => {
      expect(
        ProductDraftPatchSchema.safeParse({ chestCm: null }).success,
      ).toBe(true);
    });
  });

  describe("etsyTagsEs / etsyTagsEn", () => {
    it("rejects more than 13 tags", () => {
      const tags = Array(14).fill("tag");
      expect(
        ProductDraftPatchSchema.safeParse({ etsyTagsEs: tags }).success,
      ).toBe(false);
    });

    it("rejects a tag over 30 characters", () => {
      const r = ProductDraftPatchSchema.safeParse({
        etsyTagsEs: ["x".repeat(31)],
      });
      expect(r.success).toBe(false);
    });

    it("accepts up to 13 tags of 30 chars", () => {
      const r = ProductDraftPatchSchema.safeParse({
        etsyTagsEs: Array(13).fill("x".repeat(30)),
      });
      expect(r.success).toBe(true);
    });
  });

  describe("etsyMaterialsEs / etsyMaterialsEn", () => {
    it("allows materials up to 45 characters (longer than tags)", () => {
      expect(
        ProductDraftPatchSchema.safeParse({
          etsyMaterialsEs: ["x".repeat(45)],
        }).success,
      ).toBe(true);
      expect(
        ProductDraftPatchSchema.safeParse({
          etsyMaterialsEs: ["x".repeat(46)],
        }).success,
      ).toBe(false);
    });
  });

  describe("etsyWhenMade", () => {
    it("accepts every Etsy era value", () => {
      for (const era of ETSY_ERA_VALUES) {
        expect(
          ProductDraftPatchSchema.safeParse({ etsyWhenMade: era }).success,
        ).toBe(true);
      }
    });

    it("rejects unknown eras", () => {
      expect(
        ProductDraftPatchSchema.safeParse({
          etsyWhenMade: "2020s" as never,
        }).success,
      ).toBe(false);
    });
  });

  describe("etsyTaxonomyId", () => {
    it("rejects zero or negative", () => {
      expect(
        ProductDraftPatchSchema.safeParse({ etsyTaxonomyId: 0 }).success,
      ).toBe(false);
      expect(
        ProductDraftPatchSchema.safeParse({ etsyTaxonomyId: -1 }).success,
      ).toBe(false);
    });

    it("rejects non-integer", () => {
      expect(
        ProductDraftPatchSchema.safeParse({ etsyTaxonomyId: 12.5 }).success,
      ).toBe(false);
    });

    it("accepts positive integers + null", () => {
      expect(
        ProductDraftPatchSchema.safeParse({ etsyTaxonomyId: 6789 }).success,
      ).toBe(true);
      expect(
        ProductDraftPatchSchema.safeParse({ etsyTaxonomyId: null }).success,
      ).toBe(true);
    });
  });

  describe("image-placement fields (Task 11)", () => {
    it("accepts a valid UUID for aiModelId and null to clear", () => {
      expect(
        ProductDraftPatchSchema.safeParse({
          aiModelId: "00000000-0000-0000-0000-000000000000",
        }).success,
      ).toBe(true);
      expect(
        ProductDraftPatchSchema.safeParse({ aiModelId: null }).success,
      ).toBe(true);
    });

    it("rejects a non-UUID aiModelId", () => {
      expect(
        ProductDraftPatchSchema.safeParse({ aiModelId: "not-a-uuid" }).success,
      ).toBe(false);
    });

    it("accepts every valid pose / framing / environment preset", () => {
      for (const p of AI_POSE_PRESETS) {
        expect(
          ProductDraftPatchSchema.safeParse({ aiPosePreset: p }).success,
        ).toBe(true);
      }
      for (const f of AI_FRAMING_PRESETS) {
        expect(
          ProductDraftPatchSchema.safeParse({ aiFramingPreset: f }).success,
        ).toBe(true);
      }
      for (const e of AI_ENVIRONMENT_PRESETS) {
        expect(
          ProductDraftPatchSchema.safeParse({ aiEnvironmentPreset: e })
            .success,
        ).toBe(true);
      }
    });

    it("rejects unknown preset values", () => {
      expect(
        ProductDraftPatchSchema.safeParse({
          aiPosePreset: "lounge" as never,
        }).success,
      ).toBe(false);
      expect(
        ProductDraftPatchSchema.safeParse({
          aiFramingPreset: "head_only" as never,
        }).success,
      ).toBe(false);
      expect(
        ProductDraftPatchSchema.safeParse({
          aiEnvironmentPreset: "beach" as never,
        }).success,
      ).toBe(false);
    });

    it("does NOT accept null for the not-nullable presets", () => {
      expect(
        ProductDraftPatchSchema.safeParse({ aiPosePreset: null as never })
          .success,
      ).toBe(false);
      expect(
        ProductDraftPatchSchema.safeParse({ aiFramingPreset: null as never })
          .success,
      ).toBe(false);
      expect(
        ProductDraftPatchSchema.safeParse({
          aiEnvironmentPreset: null as never,
        }).success,
      ).toBe(false);
    });

    it("accepts every fit-override + null", () => {
      for (const fit of AI_FIT_OVERRIDES) {
        expect(
          ProductDraftPatchSchema.safeParse({ aiFitOverride: fit }).success,
        ).toBe(true);
      }
      expect(
        ProductDraftPatchSchema.safeParse({ aiFitOverride: null }).success,
      ).toBe(true);
    });

    it("accepts every panel key for aiSourcePanel + null", () => {
      for (const p of PANEL_ORDER) {
        expect(
          ProductDraftPatchSchema.safeParse({ aiSourcePanel: p }).success,
        ).toBe(true);
      }
      expect(
        ProductDraftPatchSchema.safeParse({ aiSourcePanel: null }).success,
      ).toBe(true);
    });

    it("accepts every quality tier for aiImageQuality", () => {
      for (const q of ["low", "medium", "high"] as const) {
        expect(
          ProductDraftPatchSchema.safeParse({ aiImageQuality: q }).success,
        ).toBe(true);
      }
    });

    it("rejects an unknown aiImageQuality value", () => {
      expect(
        ProductDraftPatchSchema.safeParse({
          aiImageQuality: "ultra" as never,
        }).success,
      ).toBe(false);
    });

    it("rejects an unknown source-panel value", () => {
      expect(
        ProductDraftPatchSchema.safeParse({
          aiSourcePanel: "back_portrait" as never,
        }).success,
      ).toBe(false);
    });
  });

  describe("scheduledPublishAt", () => {
    it("requires an ISO datetime string", () => {
      expect(
        ProductDraftPatchSchema.safeParse({
          scheduledPublishAt: "tomorrow",
        }).success,
      ).toBe(false);
      expect(
        ProductDraftPatchSchema.safeParse({
          scheduledPublishAt: "2026-12-31T10:00:00.000Z",
        }).success,
      ).toBe(true);
    });

    it("accepts null to clear", () => {
      expect(
        ProductDraftPatchSchema.safeParse({ scheduledPublishAt: null })
          .success,
      ).toBe(true);
    });
  });
});
