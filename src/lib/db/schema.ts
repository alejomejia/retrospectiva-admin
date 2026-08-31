import { sql } from "drizzle-orm";
import type { WebsitePayload } from "@/lib/integrations/website/payload-mapper";
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
} from "drizzle-orm/pg-core";

/**
 * Retrospectiva admin schema.
 *
 * A fresh draft is a valid row with most fields null. The new-product
 * stepper progressively fills them; publishing enforces the required
 * Etsy fields at action time, not at the DB level.
 *
 * Bilingual columns (`*_es` / `*_en`) follow the locked decision:
 * English is canonical and editable; Spanish is auto-derived via the
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
  "excellent",
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
  "thumbnail",
]);

export const aiRunKind = pgEnum("ai_run_kind", [
  "enrich",
  "translation",
  "field_regenerate",
]);

export const aiRunStatus = pgEnum("ai_run_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

/**
 * Lifecycle of a product video. The raw clip is uploaded directly to
 * R2 (presigned PUT — the app server never buffers it), then a BullMQ
 * worker transcodes it to a size-optimized 1080p H.264/MP4:
 *
 *   processing → ready   (transcode succeeded; `r2_key` now points at
 *                         the final MP4 and `raw_r2_key` is cleared)
 *   processing → failed  (ffmpeg/undecodable — `error` carries why;
 *                         BullMQ already exhausted its retries)
 */
export const videoStatus = pgEnum("video_status", [
  "processing",
  "ready",
  "failed",
]);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Identity. English title is canonical; Spanish derived by the
    // translation queue. Both nullable until step 2 of the stepper
    // (or manual entry) fills them in.
    titleEs: text("title_es"),
    titleEn: text("title_en"),
    // Short, human titles for the public storefront. Etsy titles
    // (`title_*`) are long keyword-dense SEO strings; the website wants
    // a clean, readable title instead. AI-generated at enrich (EN),
    // ES derived at the publish boundary like the other `*_es` columns.
    // The frozen slug is built from `website_title_en` (falling back to
    // `title_en`). Both nullable until step 2 fills them in; consumers
    // fall back to the Etsy title when null.
    websiteTitleEs: text("website_title_es"),
    websiteTitleEn: text("website_title_en"),
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
    // inherit the `product_settings` footer. The operator edits EN;
    // `*_es` is the cached machine translation written at save time.
    // The footer is appended only at the Etsy + website payload
    // boundary — never persisted into the description columns — so it
    // never feeds the AI enrich prompt nor the translation queue.
    listingFooterEsOverride: text("listing_footer_es_override"),
    listingFooterEnOverride: text("listing_footer_en_override"),

    // User-provided attributes (set in step 1 of the stepper).
    clothingType: clothingType("clothing_type"),
    condition: productCondition("condition").default("excellent"),
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
    // Waist is stored as a min/max pair: `waistCm` is the minimum (the
    // default, and the only value for non-elastic garments).
    // `waistMaxCm` is set only for resorted/elastic waistbands —
    // null otherwise. Both double at the boundary when the clothing
    // type marks `waist` as x2.
    waistCm: real("waist_cm"),
    waistMaxCm: real("waist_max_cm"),
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

    // Public store URL slug, e.g. `chaqueta-safari-arena-9f3c1a`.
    // Frozen at first publish (see `buildSlug`) so editing a title
    // later never breaks shared / indexed website URLs. Null until a
    // product is first published. Unique across all products.
    slug: text("slug"),

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
    // Actual sale proceeds in EUR cents, captured when the operator
    // marks the product sold. The Etsy/website list price is NOT the
    // earnings (manual discounts, fees, offline sales), so this is the
    // clean figure for earnings reporting. Required at the mark-sold
    // boundary; null for products sold before this column existed.
    soldPriceCents: integer("sold_price_cents"),
    // First-publish timestamp. Set ONCE when the product is first
    // published (via the publish worker / manual reconcile) and never
    // touched again — editing a live product must not move it. Drives
    // the storefront "NEW" badge + "this week's arrivals" (recently
    // *listed*, not recently created or edited). Null until first
    // publish; backfilled for legacy rows from the earliest
    // `etsy-publish.completed` event (fallback `created_at`).
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // Frozen copy of the last payload pushed to the public website
    // (via the `website-webhook` worker). The public catalog API
    // serves THIS — never the live columns — so per-field autosave
    // edits to a published product stay invisible to the storefront
    // until an explicit publish / update-website / sold / archive
    // action re-pushes and re-freezes the snapshot. Null until a
    // product has been pushed to the website at least once.
    websiteSnapshot: jsonb("website_snapshot").$type<WebsitePayload>(),
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
    uniqueIndex("products_slug_idx").on(t.slug),
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
    /**
     * Transcode lifecycle. Rows start `processing` (raw clip uploaded to
     * R2, transcode queued) and flip to `ready` or `failed` from the
     * worker. The UI keys readiness off this column, not off `r2_key`.
     */
    status: videoStatus("status").notNull().default("processing"),
    /**
     * Final (transcoded) MP4 object key. Null while `processing` — the
     * worker sets it when the transcode succeeds. The `<video>` player
     * only renders once a row is `ready`.
     */
    r2Key: text("r2_key"),
    /**
     * Raw uploaded source key (`video_raw/` prefix), the input the worker
     * transcodes. Set at upload time, cleared once transcode succeeds and
     * the temp object is swept. Kept on a `failed` row so the source can
     * be inspected or the job re-run.
     */
    rawR2Key: text("raw_r2_key"),
    /** Failure reason when `status='failed'`; null otherwise. */
    error: text("error"),
    /**
     * Browser-extracted poster image (WebP). Stored under the same
     * product prefix so a hard-delete by prefix sweeps both together.
     * Null if the browser couldn't decode the video frame.
     */
    posterR2Key: text("poster_r2_key"),
    /**
     * Output container mime (always `video/mp4`). Null until the transcode
     * completes — the raw source's type is intentionally not recorded.
     */
    mimeType: text("mime_type"),
    /** Transcoded file size. Null until the transcode completes. */
    sizeBytes: bigint("size_bytes", { mode: "number" }),
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
     * Subject the run is attached to — the product UUID. Nullable on
     * the FK side so the cascade on product deletion still works for
     * product-scoped runs.
     */
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
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
  // Shop-wide listing footer (care/legal boilerplate) appended to
  // every listing description at the Etsy + website payload boundary.
  // Stored as an ES/EN pair the operator maintains by hand so it never
  // reaches the AI translation queue. Per-product overrides live on
  // `products.listing_footer_*_override` (null = inherit these).
  listingFooterEs: text("listing_footer_es").notNull().default(""),
  listingFooterEn: text("listing_footer_en").notNull().default(""),

  // Shop-wide default sale percentage written to `products.discount_percent`
  // when the product form's discount toggle is switched on. The operator can
  // change this freely, and override it per product (1–99) — mirrors the
  // markup default/override split.
  defaultDiscountPercent: smallint("default_discount_percent")
    .notNull()
    .default(25),

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
export type EventRow = typeof events.$inferSelect;
export type ProductStatus = (typeof productStatus.enumValues)[number];
export type ProductCondition = (typeof productCondition.enumValues)[number];
export type ClothingType = (typeof clothingType.enumValues)[number];
