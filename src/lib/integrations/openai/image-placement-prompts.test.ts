import { describe, expect, it } from "vitest";

import type { ClothingType } from "@/lib/db/schema";

import {
  assembleImagePlacementPrompt,
  BEHAVIOR_COMPLETE,
  BEHAVIOR_CORSET,
  BEHAVIOR_LOWER,
  BEHAVIOR_SET_EXT,
  BEHAVIOR_TRENCH,
  BEHAVIOR_UPPER,
  ENVIRONMENTS,
  FIT_SENTENCES,
  FRAMINGS,
  GARMENT_DETAIL,
  IDENTITY,
  POSES,
  REALISM,
  STYLING,
  resolveSourcePanel,
  type ImagePlacementInput,
} from "./image-placement-prompts";
import { CLOTHING_TYPES } from "@/lib/products/clothing-types";

const DEFAULTS: Omit<ImagePlacementInput, "clothingType"> = {
  fitOverride: null,
  posePreset: "soft_relaxed",
  framingPreset: "waist_up",
  environmentPreset: "textured_wall",
};

function build(overrides: Partial<ImagePlacementInput> & { clothingType: ClothingType }): string {
  return assembleImagePlacementPrompt({ ...DEFAULTS, ...overrides });
}

describe("assembleImagePlacementPrompt", () => {
  it("includes all 8 blocks in the canonical order with the defaults", () => {
    const out = build({ clothingType: "jacket" });
    expect(out.startsWith(IDENTITY)).toBe(true);
    expect(out.endsWith(REALISM)).toBe(true);
    const order = [
      IDENTITY,
      GARMENT_DETAIL,
      BEHAVIOR_UPPER,
      STYLING,
      POSES.soft_relaxed,
      FRAMINGS.waist_up,
      ENVIRONMENTS.textured_wall,
      REALISM,
    ].map((b) => out.indexOf(b));
    expect(order.every((i) => i >= 0)).toBe(true);
    // Strictly increasing — each block appears after the previous.
    for (let i = 1; i < order.length; i++) {
      expect(order[i]!).toBeGreaterThan(order[i - 1]!);
    }
  });

  it("interpolates the English clothing label into {GARMENT_TYPE}", () => {
    expect(build({ clothingType: "trench_coat" })).toContain(
      "Apply the provided trench coat from the reference garment image",
    );
    expect(build({ clothingType: "set" })).toContain(
      "Apply the provided two-piece set from the reference garment image",
    );
  });

  it("always appends the detail extension after garment transfer", () => {
    const out = build({ clothingType: "shirt" });
    const transferIdx = out.indexOf("Apply the provided shirt");
    const detailIdx = out.indexOf(GARMENT_DETAIL);
    expect(detailIdx).toBeGreaterThan(transferIdx);
  });

  it("omits any fit-override sentence when fitOverride is null", () => {
    const out = build({ clothingType: "jean" });
    expect(out).not.toContain(FIT_SENTENCES.tight);
    expect(out).not.toContain(FIT_SENTENCES.loose);
    expect(out).not.toContain(FIT_SENTENCES.oversized);
  });

  it.each(["tight", "loose", "oversized"] as const)(
    "appends the %s fit sentence when fitOverride is set",
    (fit) => {
      const out = build({ clothingType: "jean", fitOverride: fit });
      expect(out).toContain(FIT_SENTENCES[fit]);
      // Detail extension still present and appears before the fit sentence.
      expect(out.indexOf(GARMENT_DETAIL)).toBeLessThan(
        out.indexOf(FIT_SENTENCES[fit]),
      );
    },
  );

  describe("behavior block mapping", () => {
    const cases: Array<[ClothingType, string]> = [
      ["shirt", BEHAVIOR_UPPER],
      ["vest", BEHAVIOR_UPPER],
      ["top", BEHAVIOR_UPPER],
      ["sweater", BEHAVIOR_UPPER],
      ["jacket", BEHAVIOR_UPPER],
      ["trench_coat", BEHAVIOR_TRENCH],
      ["corset", BEHAVIOR_CORSET],
      ["jean", BEHAVIOR_LOWER],
      ["pant", BEHAVIOR_LOWER],
      ["skirt", BEHAVIOR_LOWER],
      ["short", BEHAVIOR_LOWER],
      ["set", BEHAVIOR_COMPLETE],
      ["overall", BEHAVIOR_COMPLETE],
      ["dress", BEHAVIOR_COMPLETE],
      ["bodysuit", BEHAVIOR_COMPLETE],
    ];
    it.each(cases)("%s -> correct behavior block", (clothingType, block) => {
      expect(build({ clothingType })).toContain(block);
    });
  });

  it("appends the set-extension paragraph only for `set`", () => {
    expect(build({ clothingType: "set" })).toContain(BEHAVIOR_SET_EXT);
    expect(build({ clothingType: "overall" })).not.toContain(BEHAVIOR_SET_EXT);
    expect(build({ clothingType: "dress" })).not.toContain(BEHAVIOR_SET_EXT);
    expect(build({ clothingType: "bodysuit" })).not.toContain(BEHAVIOR_SET_EXT);
  });

  it("swaps pose / framing / environment when the user picks non-defaults", () => {
    const out = build({
      clothingType: "dress",
      posePreset: "structured_posture",
      framingPreset: "full_body",
      environmentPreset: "window_light",
    });
    expect(out).toContain(POSES.structured_posture);
    expect(out).toContain(FRAMINGS.full_body);
    expect(out).toContain(ENVIRONMENTS.window_light);
    expect(out).not.toContain(POSES.soft_relaxed);
    expect(out).not.toContain(FRAMINGS.waist_up);
    expect(out).not.toContain(ENVIRONMENTS.textured_wall);
  });
});

describe("full-prompt snapshots", () => {
  // Whole-output snapshots make variable→block coupling auditable
  // at a glance: any change to a constant or to the assembly order
  // flips the snapshot and forces a deliberate diff review. Combos
  // chosen to exercise every axis (clothing type, fit override, pose,
  // framing, environment, set-extension append).

  it("matches the canonical UPPER_BODY default (per Phase 2 §14 example)", () => {
    expect(build({ clothingType: "jacket" })).toMatchSnapshot();
  });

  it("matches LOWER_BODY with a tight fit override and full-body framing", () => {
    expect(
      build({
        clothingType: "jean",
        fitOverride: "tight",
        framingPreset: "full_body",
      }),
    ).toMatchSnapshot();
  });

  it("matches `set` (auto-appends the set-extension paragraph)", () => {
    expect(
      build({
        clothingType: "set",
        posePreset: "soft_movement",
        environmentPreset: "vintage_home",
      }),
    ).toMatchSnapshot();
  });

  it("matches TRENCH_COAT with oversized fit + window_light", () => {
    expect(
      build({
        clothingType: "trench_coat",
        fitOverride: "oversized",
        environmentPreset: "window_light",
      }),
    ).toMatchSnapshot();
  });

  it("matches CORSET with structured posture + close detail framing", () => {
    expect(
      build({
        clothingType: "corset",
        posePreset: "structured_posture",
        framingPreset: "close_detail",
      }),
    ).toMatchSnapshot();
  });
});

describe("resolveSourcePanel", () => {
  it("returns the user pick when provided", () => {
    expect(resolveSourcePanel("jacket", "back_full")).toBe("back_full");
  });

  it("falls back to the category default when userPick is null", () => {
    expect(resolveSourcePanel("jacket", null)).toBe("front_full");
    expect(resolveSourcePanel("trench_coat", null)).toBe("threequarter_full");
    expect(resolveSourcePanel("corset", null)).toBe("front_full");
    expect(resolveSourcePanel("jean", null)).toBe("threequarter_full");
    expect(resolveSourcePanel("dress", null)).toBe("threequarter_full");
  });

  it("has a default panel for every clothing type", () => {
    for (const entry of CLOTHING_TYPES) {
      expect(entry.defaultAiSourcePanel).toBeTruthy();
      expect(resolveSourcePanel(entry.value, null)).toBe(
        entry.defaultAiSourcePanel,
      );
    }
  });
});
