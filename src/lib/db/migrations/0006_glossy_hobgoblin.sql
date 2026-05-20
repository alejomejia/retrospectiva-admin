-- Recovery-aware migration: a prior generated 0006 (since deleted)
-- added `etsy_oauth.ai_image_enabled` and `products.ai_image_enabled`.
-- The toggle has been relocated to a new `product_settings` table, so
-- we drop the stale etsy_oauth column, create the new table, and add
-- the products column with IF NOT EXISTS so re-runs on a partially
-- migrated DB don't error.
ALTER TABLE "etsy_oauth" DROP COLUMN IF EXISTS "ai_image_enabled";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"ai_image_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ai_image_enabled" boolean;
