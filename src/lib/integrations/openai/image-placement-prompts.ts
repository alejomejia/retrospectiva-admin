import {
  getClothingTypeEnglishLabel,
  getDefaultAiSourcePanel,
} from "@/lib/products/clothing-types";
import type { ClothingType } from "@/lib/db/schema";
import {
  type AiEnvironmentPreset,
  type AiFitOverride,
  type AiFramingPreset,
  type AiPosePreset,
} from "@/lib/products/draft-schema";
import { fromEnv } from "@/lib/utils/helpers";

/**
 * Phase-2 image-placement prompt assembly (per-product on-model
 * image generation, Task 11).
 *
 * The full prompt is composed of 8 named blocks in a fixed order
 * (identity → garment transfer → behavior → styling → pose →
 * framing → environment → realism). Block selection is driven by
 * the inputs in `ImagePlacementInput`; everything else is constant.
 *
 * Each block string is env-overridable via an `IMAGE_PLACEMENT_*`
 * variable of the matching name so prompt iteration doesn't need
 * a redeploy — same convention as `BASE_MODEL_GENERATION_PROMPT`.
 *
 * Prompts are in English per `docs/project-conventions.md` §2
 * (admin UI is Spanish-only; outbound model calls are English).
 *
 * Reference: `docs/per-product-image-gen.md` "Prompt assembly" and
 * `docs/model-generation/phase-2-garment-application.md`.
 *
 * NOTE: this file follows the `prompts.ts` policy of reading
 * `process.env` directly (no `import "server-only"`) so the BullMQ
 * worker — which runs under raw `tsx` — can load it.
 */

// ----- Input contract ----------------------------------------------
//
// The preset string-literal types live in `draft-schema.ts` (client-
// importable, no `process.env` access at module load) and are
// re-used here as keys for the typed prompt-fragment records.

export type ImagePlacementInput = {
  clothingType: ClothingType;
  fitOverride: AiFitOverride | null;
  posePreset: AiPosePreset;
  framingPreset: AiFramingPreset;
  environmentPreset: AiEnvironmentPreset;
};

// ----- Module 1 · Identity lock (always) ---------------------------

const IDENTITY_DEFAULT = `Preserve the exact same woman from the base reference image with identical facial structure, body proportions, skin tone, hairstyle, anatomy, and identity. Do not alter the model's face, body shape, height proportions, hands, shoulders, or overall appearance.

The existing base image must remain the foundation of the composition. Only apply the garment naturally onto the existing model while preserving realistic anatomy, natural posture, and original photographic realism.`;

export const IDENTITY = fromEnv("IMAGE_PLACEMENT_IDENTITY_PROMPT", IDENTITY_DEFAULT);

// ----- Module 2 · Garment transfer (always) ------------------------

/** `{GARMENT_TYPE}` is the only placeholder; resolved at call time
 *  from the registry's `englishLabel`. */
const GARMENT_TRANSFER_DEFAULT = `Apply the provided {GARMENT_TYPE} from the reference garment image onto the existing model while preserving the exact original garment structure, stitching, proportions, folds, wrinkles, fabric texture, buttons, seams, patterns, graphics, fading, wear, and authentic vintage details.

Preserve the exact garment colors and textile behavior from the original garment image. Maintain realistic fabric physics, natural gravity-based draping, believable sleeve tension, realistic fabric bunching, and authentic second-hand garment characteristics.

Do not redesign, reinterpret, modernize, clean up, or stylize the garment.`;

export const GARMENT_TRANSFER = fromEnv(
  "IMAGE_PLACEMENT_GARMENT_TRANSFER_PROMPT",
  GARMENT_TRANSFER_DEFAULT,
);

// ----- Module 2.1 · Detail extension (always, appended to M2) -----

const GARMENT_DETAIL_DEFAULT = `Preserve the authentic vintage print scale, original textile color fading, realistic woven fabric texture, and natural aged fabric characteristics from the original garment image.`;

export const GARMENT_DETAIL = fromEnv(
  "IMAGE_PLACEMENT_GARMENT_DETAIL_PROMPT",
  GARMENT_DETAIL_DEFAULT,
);

// ----- Fit override sentences (optional, appended to M2 after M2.1) -

const FIT_TIGHT_DEFAULT = `Apply a tight body-hugging fit with realistic fabric tension and natural compression points.`;
const FIT_LOOSE_DEFAULT = `Apply a loose relaxed fit with generous fabric volume and natural draping.`;
const FIT_OVERSIZED_DEFAULT = `Apply an oversized fit with intentional excess fabric, relaxed proportions, and authentic vintage layering.`;

export const FIT_SENTENCES: Record<AiFitOverride, string> = {
  tight: fromEnv("IMAGE_PLACEMENT_FIT_TIGHT_PROMPT", FIT_TIGHT_DEFAULT),
  loose: fromEnv("IMAGE_PLACEMENT_FIT_LOOSE_PROMPT", FIT_LOOSE_DEFAULT),
  oversized: fromEnv(
    "IMAGE_PLACEMENT_FIT_OVERSIZED_PROMPT",
    FIT_OVERSIZED_DEFAULT,
  ),
};

// ----- Module 3 · Behavior (one of five, auto-selected) ------------

const BEHAVIOR_UPPER_DEFAULT = `Maintain realistic upper-body garment behavior with natural fabric draping around the shoulders, chest, waist, sleeves, and torso. Preserve authentic fabric tension, realistic folds, soft bunching, sleeve compression, and believable textile weight.

The garment should interact naturally with the model's posture and anatomy while maintaining realistic relaxed vintage clothing behavior, authentic second-hand texture characteristics, and believable casual wear imperfections.`;

const BEHAVIOR_TRENCH_DEFAULT = `Maintain realistic trench coat weight, vertical draping, layered outerwear structure, natural sleeve volume, and believable long-garment fabric gravity. Preserve authentic oversized silhouette behavior, realistic coat movement, natural open-front layering behavior, and subtle heavy-fabric tension.

The trench coat should feel naturally worn with realistic lower-body draping, soft movement, and believable vintage outerwear structure without exaggerated fashion-editorial posing.`;

const BEHAVIOR_CORSET_DEFAULT = `Maintain realistic corset structure, authentic fabric tension, natural compression behavior, and believable body contour interaction. Preserve the exact corset shape, boning structure, stitching, tightening behavior, and realistic textile rigidity without distorting anatomy.

The corset should feel naturally worn with subtle realistic fabric tension around the torso, believable shaping behavior, and authentic vintage garment structure while maintaining realistic human proportions and soft natural posture.`;

const BEHAVIOR_LOWER_DEFAULT = `Maintain realistic lower-body garment behavior with authentic fabric interaction around the waist, hips, thighs, knees, and legs. Preserve natural folds, believable compression points, realistic draping, subtle bunching, and authentic second-hand textile behavior.

The garment should respond naturally to posture, gravity, and body positioning while maintaining believable vintage wear patterns, realistic silhouette flow, and authentic fabric tension.`;

const BEHAVIOR_COMPLETE_DEFAULT = `Maintain realistic full-body garment behavior with natural fabric flow across the upper and lower body, believable silhouette transitions, authentic textile draping, and realistic body movement interaction.

Preserve natural garment continuity, realistic folds, subtle fabric tension, believable gravity behavior, and authentic vintage texture characteristics throughout the entire outfit.

The garment should feel naturally worn and realistically fitted without exaggerated perfection or artificial fashion-editorial styling.`;

/** Auto-appended (with a blank-line separator) to the Complete-garment
 *  behavior block when `clothingType === 'set'`. The other COMPLETE
 *  members (`overall`, `dress`, `bodysuit`) do not get this paragraph. */
const BEHAVIOR_SET_EXT_DEFAULT = `Preserve the coordinated relationship between all garment pieces, including matching fabric behavior, proportional consistency, textile continuity, and authentic outfit balance.`;

export const BEHAVIOR_UPPER = fromEnv(
  "IMAGE_PLACEMENT_BEHAVIOR_UPPER_PROMPT",
  BEHAVIOR_UPPER_DEFAULT,
);
export const BEHAVIOR_TRENCH = fromEnv(
  "IMAGE_PLACEMENT_BEHAVIOR_TRENCH_PROMPT",
  BEHAVIOR_TRENCH_DEFAULT,
);
export const BEHAVIOR_CORSET = fromEnv(
  "IMAGE_PLACEMENT_BEHAVIOR_CORSET_PROMPT",
  BEHAVIOR_CORSET_DEFAULT,
);
export const BEHAVIOR_LOWER = fromEnv(
  "IMAGE_PLACEMENT_BEHAVIOR_LOWER_PROMPT",
  BEHAVIOR_LOWER_DEFAULT,
);
export const BEHAVIOR_COMPLETE = fromEnv(
  "IMAGE_PLACEMENT_BEHAVIOR_COMPLETE_PROMPT",
  BEHAVIOR_COMPLETE_DEFAULT,
);
export const BEHAVIOR_SET_EXT = fromEnv(
  "IMAGE_PLACEMENT_BEHAVIOR_SET_EXT_PROMPT",
  BEHAVIOR_SET_EXT_DEFAULT,
);

const BEHAVIOR_BY_TYPE: Record<ClothingType, string> = {
  shirt: BEHAVIOR_UPPER,
  vest: BEHAVIOR_UPPER,
  top: BEHAVIOR_UPPER,
  sweater: BEHAVIOR_UPPER,
  jacket: BEHAVIOR_UPPER,
  trench_coat: BEHAVIOR_TRENCH,
  corset: BEHAVIOR_CORSET,
  jean: BEHAVIOR_LOWER,
  pant: BEHAVIOR_LOWER,
  skirt: BEHAVIOR_LOWER,
  short: BEHAVIOR_LOWER,
  set: BEHAVIOR_COMPLETE,
  overall: BEHAVIOR_COMPLETE,
  dress: BEHAVIOR_COMPLETE,
  bodysuit: BEHAVIOR_COMPLETE,
};

// ----- Module 4 · Styling / accessories (always) -------------------

const STYLING_DEFAULT = `Style the model with subtle vintage-inspired complementary clothing layers and minimal accessories that naturally match the garment's aesthetic, era, color palette, silhouette, and overall mood.

The styling should feel authentic, understated, and naturally assembled by a real person rather than professionally fashion-styled.

Accessories may include subtle vintage jewelry, small earrings, delicate necklaces, simple rings, thin belts, neutral layering basics, or soft lifestyle elements that complement the garment without competing with it.

All additional styling elements must remain visually secondary to the main garment being sold.

Avoid statement accessories, luxury fashion styling, excessive layering, loud colors, oversized jewelry, trend-heavy aesthetics, editorial fashion compositions, or distracting secondary garments.

The primary garment must remain the clear visual focus of the entire image.`;

export const STYLING = fromEnv("IMAGE_PLACEMENT_STYLING_PROMPT", STYLING_DEFAULT);

// ----- Module 5 · Pose presets (one of three) ----------------------

const POSE_SOFT_RELAXED_DEFAULT = `Natural relaxed standing posture with subtle human asymmetry, soft shoulder positioning, relaxed arms, natural hand placement, slight weight shift, and believable casual body posture. The pose should feel natural and unintentionally stylish, like a real person casually modeling clothing for a vintage marketplace listing.`;

const POSE_SOFT_MOVEMENT_DEFAULT = `Subtle natural body movement with relaxed posture, gentle motion in the arms and torso, and believable casual lifestyle energy. Maintain realistic fabric movement without exaggerated fashion posing.`;

const POSE_STRUCTURED_POSTURE_DEFAULT = `Confident upright posture with subtle relaxed elegance, minimal movement, natural arm positioning, and clear garment visibility while maintaining a believable human stance.`;

export const POSES: Record<AiPosePreset, string> = {
  soft_relaxed: fromEnv(
    "IMAGE_PLACEMENT_POSE_SOFT_RELAXED_PROMPT",
    POSE_SOFT_RELAXED_DEFAULT,
  ),
  soft_movement: fromEnv(
    "IMAGE_PLACEMENT_POSE_SOFT_MOVEMENT_PROMPT",
    POSE_SOFT_MOVEMENT_DEFAULT,
  ),
  structured_posture: fromEnv(
    "IMAGE_PLACEMENT_POSE_STRUCTURED_PROMPT",
    POSE_STRUCTURED_POSTURE_DEFAULT,
  ),
};

// ----- Module 6 · Framing presets (one of four) --------------------

const FRAMING_WAIST_UP_DEFAULT = `Medium lifestyle crop framed from approximately waist level upward, maintaining strong garment visibility, natural composition, and authentic vintage ecommerce photography aesthetics.`;

const FRAMING_THIGHS_UP_DEFAULT = `Lifestyle fashion crop framed from mid-thigh upward with balanced visibility of the garment silhouette, natural body proportions, and casual ecommerce photography composition.`;

const FRAMING_FULL_BODY_DEFAULT = `Full body vertical composition with realistic proportions, natural stance, and clean visibility of the entire garment while maintaining relaxed lifestyle realism.`;

const FRAMING_CLOSE_DETAIL_DEFAULT = `Closer editorial-style garment framing focused on textile detail, upper body styling, and realistic fabric texture while preserving believable lifestyle photography realism.`;

export const FRAMINGS: Record<AiFramingPreset, string> = {
  waist_up: fromEnv(
    "IMAGE_PLACEMENT_FRAMING_WAIST_UP_PROMPT",
    FRAMING_WAIST_UP_DEFAULT,
  ),
  thighs_up: fromEnv(
    "IMAGE_PLACEMENT_FRAMING_THIGHS_UP_PROMPT",
    FRAMING_THIGHS_UP_DEFAULT,
  ),
  full_body: fromEnv(
    "IMAGE_PLACEMENT_FRAMING_FULL_BODY_PROMPT",
    FRAMING_FULL_BODY_DEFAULT,
  ),
  close_detail: fromEnv(
    "IMAGE_PLACEMENT_FRAMING_CLOSE_DETAIL_PROMPT",
    FRAMING_CLOSE_DETAIL_DEFAULT,
  ),
};

// ----- Module 7 · Environment presets (one of five) ----------------

const ENV_TEXTURED_WALL_DEFAULT = `Soft natural lifestyle photography near a lightly textured neutral wall with subtle daylight illumination, minimal distractions, soft natural shadows, and clean vintage ecommerce aesthetics.`;

const ENV_MINIMAL_APARTMENT_DEFAULT = `Minimal warm apartment interior with soft natural daylight, subtle furniture presence, neutral tones, and believable lived-in atmosphere without distracting from the garment.`;

const ENV_SOFT_STUDIO_DEFAULT = `Clean soft studio environment with subtle natural shadows, neutral tones, diffused daylight-style illumination, and realistic professional ecommerce photography atmosphere.`;

const ENV_VINTAGE_HOME_DEFAULT = `Subtle vintage-inspired home environment with soft natural lighting, warm neutral textures, minimal visual distractions, and authentic cozy lifestyle realism.`;

const ENV_WINDOW_LIGHT_DEFAULT = `Soft window-side natural lighting with realistic daylight falloff, gentle shadows, warm natural atmosphere, and believable candid lifestyle photography aesthetics.`;

export const ENVIRONMENTS: Record<AiEnvironmentPreset, string> = {
  textured_wall: fromEnv(
    "IMAGE_PLACEMENT_ENV_TEXTURED_WALL_PROMPT",
    ENV_TEXTURED_WALL_DEFAULT,
  ),
  minimal_apartment: fromEnv(
    "IMAGE_PLACEMENT_ENV_MINIMAL_APARTMENT_PROMPT",
    ENV_MINIMAL_APARTMENT_DEFAULT,
  ),
  soft_studio: fromEnv(
    "IMAGE_PLACEMENT_ENV_SOFT_STUDIO_PROMPT",
    ENV_SOFT_STUDIO_DEFAULT,
  ),
  vintage_home: fromEnv(
    "IMAGE_PLACEMENT_ENV_VINTAGE_HOME_PROMPT",
    ENV_VINTAGE_HOME_DEFAULT,
  ),
  window_light: fromEnv(
    "IMAGE_PLACEMENT_ENV_WINDOW_LIGHT_PROMPT",
    ENV_WINDOW_LIGHT_DEFAULT,
  ),
};

// ----- Module 8 · Realism block (always) ---------------------------

const REALISM_DEFAULT = `Ultra realistic humanized ecommerce photography with authentic natural imperfections, realistic textile behavior, subtle asymmetry, believable posture, realistic skin texture, soft natural lighting, and genuine human presence.

The final image should feel like a real vintage clothing listing photographed by a real person for a real marketplace, not like an AI-generated luxury fashion campaign.

Avoid overprocessed skin, artificial perfection, exaggerated posing, editorial fashion aesthetics, cinematic lighting, unrealistic anatomy, distorted hands, distorted garments, excessive beauty retouching, or overly stylized AI aesthetics.`;

export const REALISM = fromEnv("IMAGE_PLACEMENT_REALISM_PROMPT", REALISM_DEFAULT);

// ----- Assembly ----------------------------------------------------

/**
 * Build the full image-placement prompt from a typed input. Joins
 * eight blocks in the fixed order specified by Phase 2 §3:
 *
 *   1. Identity
 *   2. Garment transfer (= transfer + detail extension + optional fit)
 *   3. Behavior (= category block + optional `set` extension)
 *   4. Styling
 *   5. Pose
 *   6. Framing
 *   7. Environment
 *   8. Realism
 *
 * Blocks are joined with a blank line (`\n\n`). The runtime never
 * reorders them — order matters for how `gpt-image-2` weights the
 * constraints (identity first, realism last as the override).
 */
export function assembleImagePlacementPrompt(input: ImagePlacementInput): string {
  const garmentTransfer = buildGarmentTransfer(
    input.clothingType,
    input.fitOverride,
  );
  const behavior = buildBehavior(input.clothingType);
  return [
    IDENTITY,
    garmentTransfer,
    behavior,
    STYLING,
    POSES[input.posePreset],
    FRAMINGS[input.framingPreset],
    ENVIRONMENTS[input.environmentPreset],
    REALISM,
  ].join("\n\n");
}

function buildGarmentTransfer(
  clothingType: ClothingType,
  fitOverride: AiFitOverride | null,
): string {
  const transfer = GARMENT_TRANSFER.replace(
    /\{GARMENT_TYPE\}/g,
    getClothingTypeEnglishLabel(clothingType),
  );
  const parts = [transfer, GARMENT_DETAIL];
  if (fitOverride !== null) parts.push(FIT_SENTENCES[fitOverride]);
  return parts.join("\n\n");
}

function buildBehavior(clothingType: ClothingType): string {
  const base = BEHAVIOR_BY_TYPE[clothingType];
  return clothingType === "set" ? `${base}\n\n${BEHAVIOR_SET_EXT}` : base;
}

// ----- Source-panel resolution -------------------------------------

import type { PanelKey } from "./panel-keys";

/**
 * Resolve the panel the image-placement worker should load from R2.
 * Returns the user pick when set; otherwise the registry default for
 * the clothing type (Phase 2 §12, kept on `ClothingTypeEntry`).
 */
export function resolveSourcePanel(
  clothingType: ClothingType,
  userPick: PanelKey | null,
): PanelKey {
  return userPick ?? getDefaultAiSourcePanel(clothingType);
}
