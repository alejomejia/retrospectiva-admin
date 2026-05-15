import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  jsonb,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Retrospectiva admin schema — initial migration target.
 *
 * Tables are kept extensible: the product form ships with name + price only
 * (per the MVP scope), but every adjacent table the rest of the system needs
 * (images, AI runs, events for the activity feed, Etsy tokens, idempotency
 * keys for webhooks/jobs) is wired up from day one so later phases just add
 * server logic on top, no schema thrash.
 */

export const productStatus = pgEnum("product_status", [
  "draft",
  "published",
  "sold",
  "archived",
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
    name: text("name").notNull(),
    // Money is stored in the smallest unit (cents) to avoid float drift.
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    status: productStatus("status").notNull().default("draft"),
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
