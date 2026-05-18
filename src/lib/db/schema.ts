import { sql } from "drizzle-orm";
import {
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
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
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
  // Shop-wide publish defaults — set in /settings/etsy. Per-product
  // fields (taxonomy, section, era) live on the product, not here.
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
export type EventRow = typeof events.$inferSelect;
export type ProductStatus = (typeof productStatus.enumValues)[number];
export type ProductCondition = (typeof productCondition.enumValues)[number];
export type ClothingType = (typeof clothingType.enumValues)[number];
