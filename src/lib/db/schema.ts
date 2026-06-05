import { sql } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  uuid,
  integer,
  real,
  smallint,
  timestamp,
  jsonb,
  bigint,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Retrospectiva admin schema.
 *
 * A fresh draft is a valid row with most fields null. The new-product
 * stepper progressively fills them; publishing enforces the required
 * Etsy fields at action time, not at the DB level.
 *
 * Bilingual columns (`*_es` / `*_en`) follow the locked decision:
 * Spanish is canonical and editable; English is auto-derived via the
 * translation queue.
 */

export const productStatus = pgEnum("product_status", [
  "draft",
  "scheduled",
  "published",
  "sold",
  "archived",
]);

export const productCondition = pgEnum("product_condition", [
  "perfect",
  "very_good",
  "good",
]);

export const clothingType = pgEnum("clothing_type", [
  // Upper body.
  "shirt",
  "vest",
  "top",
  "sweater",
  "jacket",
  "trench_coat",
  // Special upper body.
  "corset",
  // Lower body.
  "jean",
  "pant",
  "skirt",
  "short",
  // Complete garments.
  "set",
  "overall",
  "dress",
  "bodysuit",
]);

export const imageRole = pgEnum("image_role", [
  "original",
  "ai_model",
  // User-uploaded garment-on-white-wall input for Phase 2 image
  // placement (Task 11). Excluded from the Etsy publish payload —
  // only `original` + `ai_model` roles ship to listings.
  "ai_reference",
  "thumbnail",
]);

export const aiRunKind = pgEnum("ai_run_kind", [
  "enrich",
  "translation",
  "model_generation",
  "model_placement",
  "field_regenerate",
]);

export const aiModelStatus = pgEnum("ai_model_status", [
  "draft",
  "active",
  "archived",
]);

export const aiRunStatus = pgEnum("ai_run_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Identity. Spanish title is canonical; English derived by the
    // translation queue. Both nullable until step 2 of the stepper
    // (or manual entry) fills them in.
    titleEs: text("title_es"),
    titleEn: text("title_en"),
    descriptionEs: text("description_es"),
    descriptionEn: text("description_en"),

    // Pricing. Money is in cents to avoid float drift. Base = the
    // earn target; effective list price = base * (1 + markup/100)
    // unless `list_price_cents_override` is set.
    basePriceCents: integer("base_price_cents"),
    currency: text("currency").notNull().default("EUR"),
    markupPercentOverride: smallint("markup_percent_override"),
    listPriceCentsOverride: integer("list_price_cents_override"),
    // Optional per-product sale. When set, the Etsy listing (and the
    // website "compare-at" price) is inflated so a matching `%` sale —
    // run manually in Etsy Shop Manager — lands the buyer back near the
    // effective list price. null/0 = no discount. See `inflatedListCents`.
    discountPercent: smallint("discount_percent"),
    // Cost of the garment to the shop, in EUR cents. Snapshotted from
    // `clothing_buy_price_defaults` when the clothing type is first
    // set (only when this column is null) — later changes to defaults
    // do NOT backfill existing products. User can override via the
    // step-1 input. Earnings = base_price_cents - buy_price_cents.
    buyPriceCents: integer("buy_price_cents"),

    // Free-text notes the user adds in step 1. Passed to the AI
    // enrichment prompt so the model weaves them into the description.
    comments: text("comments"),

    // Optional per-product override of the shop-wide listing footer
    // (the care/legal boilerplate appended to every listing). null =
    // inherit the `product_settings` footer. The operator edits ES;
    // `*_en` is the cached machine translation written at save time.
    // The footer is appended only at the Etsy + website payload
    // boundary — never persisted into the description columns — so it
    // never feeds the AI enrich prompt nor the translation queue.
    listingFooterEsOverride: text("listing_footer_es_override"),
    listingFooterEnOverride: text("listing_footer_en_override"),

    // User-provided attributes (set in step 1 of the stepper).
    clothingType: clothingType("clothing_type"),
    condition: productCondition("condition").default("perfect"),
    // Single size value matching Etsy's "US Women's Letter" scale
    // (XXS, XS, S, M, L, XL, 1X, 2X, 3X). Migrated from the prior
    // `sizes` text[] by snapshotting the first array element.
    size: text("size"),
    // Whether this listing should be marked as a shop-featured
    // product. Mapped to Etsy's `featured_rank` on publish; Etsy
    // caps featured listings at 4 per shop so the operator picks
    // sparingly.
    isFeatured: boolean("is_featured").notNull().default(false),

    // Measurements in cm, stored flat (as measured across the
    // garment). Doubled (×2) at the Etsy / website-payload boundary
    // for chest / waist / hip / leg — see clothing-types.ts.
    shoulderCm: real("shoulder_cm"),
    sleeveWidthCm: real("sleeve_width_cm"),
    sleeveLengthCm: real("sleeve_length_cm"),
    chestCm: real("chest_cm"),
    waistCm: real("waist_cm"),
    hipCm: real("hip_cm"),
    riseCm: real("rise_cm"),
    legCm: real("leg_cm"),
    lengthCm: real("length_cm"),
    braSize: text("bra_size"),

    // Etsy-bound metadata. AI-generated, user-editable in step 2.
    etsyTagsEs: text("etsy_tags_es")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    etsyTagsEn: text("etsy_tags_en")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    etsyMaterialsEs: text("etsy_materials_es")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    etsyMaterialsEn: text("etsy_materials_en")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    etsyWhenMade: text("etsy_when_made"),
    etsyTaxonomyId: bigint("etsy_taxonomy_id", { mode: "number" }),
    // Etsy listing colors (free-form values pulled from Etsy's
    // primary/secondary color vocabulary). AI enrich fills these from
    // the product photos; user can override in step 2. Stored as
    // canonical lowercase strings matching the validator in
    // `etsy-colors.ts`.
    etsyPrimaryColor: text("etsy_primary_color"),
    etsySecondaryColor: text("etsy_secondary_color"),

    // Etsy shipping profile for this listing. Auto-picked at step-1
    // from the shop-wide weight-class mapping based on `clothingType`,
    // user can override via the step-1 picker. Required before publish.
    shippingProfileId: bigint("shipping_profile_id", { mode: "number" }),

    // Per-product override for the shop-wide AI image generation
    // toggle (product_settings.ai_image_enabled). null = inherit shop
    // default; true/false = explicit per-product override. Read at
    // the image-placement-worker boundary (Task 11).
    aiImageEnabled: boolean("ai_image_enabled"),

    // ----- Image-placement inputs (Task 11) ------------------------
    //
    // The 6 user-controllable variables consumed by
    // `assembleImagePlacementPrompt`. Stored as text + validated at
    // the zod boundary (`draft-schema.ts`) so prompt-preset iteration
    // doesn't require a migration. Pose / framing / environment have
    // hard-coded defaults; source panel + fit override default to null
    // (worker resolves source panel from `clothingType` per-category).
    aiModelId: uuid("ai_model_id").references(
      (): AnyPgColumn => aiModels.id,
      { onDelete: "set null" },
    ),
    aiSourcePanel: text("ai_source_panel"),
    aiPosePreset: text("ai_pose_preset").notNull().default("soft_relaxed"),
    aiFramingPreset: text("ai_framing_preset").notNull().default("waist_up"),
    aiEnvironmentPreset: text("ai_environment_preset")
      .notNull()
      .default("textured_wall"),
    aiFitOverride: text("ai_fit_override"),
    /**
     * `gpt-image-2` quality tier the image-placement worker passes
     * to `openai.images.edit` for THIS product. Default `'low'` (the
     * cheap, iteration-friendly tier — placement runs are the high
     * volume call in the pipeline). Mirrors `ai_models.image_quality`.
     */
    aiImageQuality: text("ai_image_quality").notNull().default("low"),

    // Lifecycle.
    status: productStatus("status").notNull().default("draft"),
    scheduledPublishAt: timestamp("scheduled_publish_at", {
      withTimezone: true,
    }),
    // Populated once a published product is created on Etsy. The
    // listing id alone is enough to deep-link the public store CTA
    // (`https://www.etsy.com/listing/{id}`).
    etsyListingId: bigint("etsy_listing_id", { mode: "number" }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("products_status_idx").on(t.status),
    index("products_created_at_idx").on(t.createdAt),
    index("products_scheduled_publish_at_idx").on(t.scheduledPublishAt),
    uniqueIndex("products_etsy_listing_id_idx").on(t.etsyListingId),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    role: imageRole("role").notNull().default("original"),
    order: integer("order").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("product_images_product_idx").on(t.productId, t.order)],
);

/**
 * Video assets. Kept separate from `product_images` because the shape
 * differs enough (duration, poster reference, codec/mime) that mixing
 * them in one table would force NULL-heavy columns. Etsy's API also
 * splits the two (`getListingImages` vs `getListingVideos`), so we'd
 * end up branching at the publish boundary anyway.
 */
export const productVideos = pgTable(
  "product_videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** The video object key. */
    r2Key: text("r2_key").notNull(),
    /**
     * Browser-extracted poster image (WebP). Stored under the same
     * product prefix so a hard-delete by prefix sweeps both together.
     * Null if the browser couldn't decode the video frame.
     */
    posterR2Key: text("poster_r2_key"),
    /** e.g. `video/mp4`, `video/quicktime`. Useful for the <video> element. */
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    /** Null if we couldn't read it during the client-side capture. */
    durationMs: integer("duration_ms"),
    width: integer("width"),
    height: integer("height"),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("product_videos_product_idx").on(t.productId, t.order)],
);

export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Subject the run is attached to. For per-product runs
     * (`enrich`, `translation`, `model_placement`, etc.) this is the
     * product UUID. For shop-wide runs (`model_generation` from the
     * Model Studio) we leave it null — the back-reference lives on
     * `ai_models.ai_run_id` instead. Nullable on the FK side so the
     * cascade on product deletion still works for product-scoped
     * runs.
     */
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    /** Set for `kind='model_generation'` runs; null otherwise. */
    aiModelId: uuid("ai_model_id"),
    kind: aiRunKind("kind").notNull(),
    status: aiRunStatus("status").notNull().default("pending"),
    model: text("model"),
    inputJson: jsonb("input_json"),
    outputJson: jsonb("output_json"),
    // USD cost as a float-string in jsonb-adjacent column; precise enough
    // for monthly totals without bringing decimal arithmetic into TS.
    costUsd: text("cost_usd"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("ai_runs_product_idx").on(t.productId),
    index("ai_runs_created_at_idx").on(t.createdAt),
  ],
);

/**
 * Synthetic AI fashion models. Generated once via the Model Studio
 * (`/models`) and reused across product image generations. Decoupled
 * from `products` — these are shop-wide assets, not per-product.
 *
 * Lifecycle: `draft` (just generated, awaiting user review) → `active`
 * (saved with a label, available for per-product selection) →
 * `archived` (out of rotation but kept for provenance on products
 * that already used the model).
 *
 * R2 layout: `assets/models/{id}/{contact-sheet|front_full|…}.png`.
 * The contact sheet is the canonical artifact; the six panel crops
 * are derivatives produced by `grid-crop.ts` after the worker
 * downloads the OpenAI output. If gutter detection fails, only the
 * sheet is stored and `crops_available=false`.
 */
export const aiModels = pgTable(
  "ai_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** User-chosen short name ("Lucía", "Sofía", …). Null until the
     *  user clicks Guardar on the post-generation preview. */
    label: text("label"),
    status: aiModelStatus("status").notNull().default("draft"),

    // Generation inputs — exact strings interpolated into the
    // BASE_MODEL_GENERATION prompt. Stored verbatim so "Regenerar"
    // and "Clonar" workflows can reuse the same vars.
    ageRange: text("age_range").notNull(),
    bodyType: text("body_type").notNull(),
    heightRange: text("height_range").notNull(),
    skinTone: text("skin_tone").notNull(),
    faceShape: text("face_shape").notNull(),
    hairColor: text("hair_color").notNull(),
    hairShape: text("hair_shape").notNull(),
    hairType: text("hair_type").notNull(),

    // R2 keys. `contactSheetKey` is null until generation succeeds.
    // The six panel keys are null when `cropsAvailable=false` (gutter
    // detection couldn't find a clean 3×2 grid in the model output).
    contactSheetKey: text("contact_sheet_key"),
    frontFullKey: text("front_full_key"),
    frontPortraitKey: text("front_portrait_key"),
    frontEditorialKey: text("front_editorial_key"),
    sidePortraitKey: text("side_portrait_key"),
    backFullKey: text("back_full_key"),
    threequarterFullKey: text("threequarter_full_key"),
    cropsAvailable: boolean("crops_available").notNull().default(false),

    /**
     * `gpt-image-2` quality tier used for THIS row's generation.
     * Default `'low'` (cheap, good enough for the identity pass);
     * the operator can pick `'medium'` or `'high'` on the new-model
     * form. Validated app-side as a zod enum so future tiers (e.g.
     * `'auto'`) don't require a migration. Read by the worker each
     * generation run, so `Regenerar` honors the latest persisted
     * value.
     */
    imageQuality: text("image_quality").notNull().default("low"),

    /** Pointer to the last successful generation run. Audit/cost. */
    aiRunId: uuid("ai_run_id").references(() => aiRuns.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("ai_models_status_idx").on(t.status),
    index("ai_models_created_at_idx").on(t.createdAt),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    // Username from ALLOW_USERS, or "system" for automation.
    actor: text("actor").notNull(),
    type: text("type").notNull(),
    payloadJson: jsonb("payload_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("events_created_at_idx").on(t.createdAt),
    index("events_product_idx").on(t.productId),
    index("events_type_idx").on(t.type),
  ],
);

export const etsyOauth = pgTable("etsy_oauth", {
  id: uuid("id").primaryKey().defaultRandom(),
  shopId: bigint("shop_id", { mode: "number" }).notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  scopes: text("scopes").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  // Shop-wide publish defaults — shipping mapping + returns set in
  // /settings/integrations, markup set in /settings/products.
  // Per-product fields (taxonomy, section, era) live on the product.
  //
  // Shipping is configured as a three-tier mapping (light / medium /
  // heavy) rather than a single default. Step-1 auto-picks the
  // matching profile based on the garment's `shippingWeightClass`
  // (see clothing-types.ts) and writes it onto `products.shipping_profile_id`.
  shippingProfileLightId: bigint("shipping_profile_light_id", {
    mode: "number",
  }),
  shippingProfileMediumId: bigint("shipping_profile_medium_id", {
    mode: "number",
  }),
  shippingProfileHeavyId: bigint("shipping_profile_heavy_id", {
    mode: "number",
  }),
  defaultReturnPolicyId: bigint("default_return_policy_id", {
    mode: "number",
  }),
  // Shop-wide default Etsy "readiness state" (processing profile).
  // Etsy v3 made this required on createDraftListing for physical
  // listings — the operator picks one in /settings/integrations from
  // the list fetched via `listReadinessStates`. The publish processor
  // emits it as `readiness_state_id` on the create-draft payload.
  defaultReadinessStateId: bigint("default_readiness_state_id", {
    mode: "number",
  }),
  // Etsy-fee + commission markup applied to `products.base_price_cents`
  // when computing the listing price. Editable per-product via
  // `products.markup_percent_override`.
  markupPercent: smallint("markup_percent").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

/**
 * Singleton row of shop-wide product defaults that aren't tied to
 * any single integration. Lives at /settings/products. The `id`
 * column defaults to a fixed sentinel so the row is upserted once
 * and never duplicated.
 */
export const productSettings = pgTable("product_settings", {
  id: text("id").primaryKey().default("singleton"),
  // Shop-wide default for AI image generation on products. Per-product
  // override lives on `products.ai_image_enabled` (null = inherit).
  // Read at the image-placement-worker boundary (Task 11) — cheaper
  // to short-circuit at enqueue time than to skip mid-worker.
  aiImageEnabled: boolean("ai_image_enabled").notNull().default(true),

  // Shop-wide listing footer (care/legal boilerplate) appended to
  // every listing description at the Etsy + website payload boundary.
  // Stored as an ES/EN pair the operator maintains by hand so it never
  // reaches the AI translation queue. Per-product overrides live on
  // `products.listing_footer_*_override` (null = inherit these).
  listingFooterEs: text("listing_footer_es").notNull().default(""),
  listingFooterEn: text("listing_footer_en").notNull().default(""),

  // ----- Image-placement shop defaults (Task 11) ------------------
  //
  // Snapshotted onto a fresh `products` row at draft-creation time
  // (see `createDraftProduct`). Later changes here do NOT cascade
  // into existing products — matches the `buyPriceCents` precedent.
  // Per-product columns on `products` remain authoritative once set.
  aiDefaultModelId: uuid("ai_default_model_id").references(
    (): AnyPgColumn => aiModels.id,
    { onDelete: "set null" },
  ),
  aiDefaultSourcePanel: text("ai_default_source_panel"),
  aiDefaultPosePreset: text("ai_default_pose_preset")
    .notNull()
    .default("soft_relaxed"),
  aiDefaultFramingPreset: text("ai_default_framing_preset")
    .notNull()
    .default("waist_up"),
  aiDefaultEnvironmentPreset: text("ai_default_environment_preset")
    .notNull()
    .default("textured_wall"),
  aiDefaultImageQuality: text("ai_default_image_quality")
    .notNull()
    .default("low"),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

/**
 * Per clothing-type default buy price (cost to the shop), in EUR
 * cents. One row per clothing type. New products read this on first
 * clothing_type set to snapshot the value onto `products.buy_price_cents`;
 * later changes here do NOT cascade into existing products. Edited in
 * /settings/products.
 */
export const clothingBuyPriceDefaults = pgTable(
  "clothing_buy_price_defaults",
  {
    clothingType: clothingType("clothing_type").primaryKey(),
    defaultBuyPriceCents: integer("default_buy_price_cents").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
);

/**
 * Deduplication for webhook deliveries and idempotent job triggers.
 * `purpose` lets multiple subsystems share the same table (e.g.
 * `etsy-receipt:1234`, `r2-cleanup:product:abc`).
 */
export const jobsIdempotency = pgTable("jobs_idempotency", {
  id: text("id").primaryKey(),
  purpose: text("purpose").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type ProductVideo = typeof productVideos.$inferSelect;
export type AiRun = typeof aiRuns.$inferSelect;
export type AiModel = typeof aiModels.$inferSelect;
export type NewAiModel = typeof aiModels.$inferInsert;
export type EventRow = typeof events.$inferSelect;
export type ProductStatus = (typeof productStatus.enumValues)[number];
export type ProductCondition = (typeof productCondition.enumValues)[number];
export type ClothingType = (typeof clothingType.enumValues)[number];
export type AiModelStatus = (typeof aiModelStatus.enumValues)[number];
