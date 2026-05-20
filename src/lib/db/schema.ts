import { sql } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  uuid,
  integer,
  smallint,
  timestamp,
  jsonb,
  bigint,
  index,
  uniqueIndex,
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
  "thumbnail",
]);

export const aiRunKind = pgEnum("ai_run_kind", [
  "description",
  "era",
  "model_placement",
  "title",
  "tags",
  "materials",
  "taxonomy",
  "when_made",
  "translation",
  "enrich",
  "model_generation",
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
    // Cost of the garment to the shop, in EUR cents. Snapshotted from
    // `clothing_buy_price_defaults` when the clothing type is first
    // set (only when this column is null) — later changes to defaults
    // do NOT backfill existing products. User can override via the
    // step-1 input. Earnings = base_price_cents - buy_price_cents.
    buyPriceCents: integer("buy_price_cents"),

    // User-provided attributes (set in step 1 of the stepper).
    clothingType: clothingType("clothing_type"),
    condition: productCondition("condition"),
    sizes: text("sizes").array().notNull().default(sql`'{}'::text[]`),

    // Measurements in cm, stored flat (as measured across the
    // garment). Doubled (×2) at the Etsy / website-payload boundary
    // for chest / waist / hip / leg — see clothing-types.ts.
    shoulderCm: integer("shoulder_cm"),
    chestCm: integer("chest_cm"),
    waistCm: integer("waist_cm"),
    hipCm: integer("hip_cm"),
    riseCm: integer("rise_cm"),
    legCm: integer("leg_cm"),
    lengthCm: integer("length_cm"),
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

    // Per-product override for the shop-wide AI image generation
    // toggle (etsy_oauth.ai_image_enabled). null = inherit shop
    // default; true/false = explicit per-product override. Read at
    // the image-placement-worker boundary (Task 11).
    aiImageEnabled: boolean("ai_image_enabled"),

    // Lifecycle.
    status: productStatus("status").notNull().default("draft"),
    scheduledPublishAt: timestamp("scheduled_publish_at", {
      withTimezone: true,
    }),
    // Populated once a published product is created on Etsy.
    etsyListingId: bigint("etsy_listing_id", { mode: "number" }),
    etsyState: text("etsy_state"),
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
  // Shop-wide publish defaults — shipping/returns set in
  // /settings/integrations, markup set in /settings/products.
  // Per-product fields (taxonomy, section, era) live on the product.
  defaultShippingProfileId: bigint("default_shipping_profile_id", {
    mode: "number",
  }),
  defaultReturnPolicyId: bigint("default_return_policy_id", {
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
