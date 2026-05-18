CREATE EXTENSION IF NOT EXISTS "unaccent";--> statement-breakpoint
CREATE TYPE "public"."clothing_type" AS ENUM('shirt', 'vest', 'top', 'sweater', 'jacket', 'trench_coat', 'corset', 'jean', 'pant', 'skirt', 'short', 'set', 'overall', 'dress', 'bodysuit');--> statement-breakpoint
CREATE TYPE "public"."product_condition" AS ENUM('perfect', 'very_good', 'good');--> statement-breakpoint
ALTER TYPE "public"."ai_run_kind" ADD VALUE 'title';--> statement-breakpoint
ALTER TYPE "public"."ai_run_kind" ADD VALUE 'tags';--> statement-breakpoint
ALTER TYPE "public"."ai_run_kind" ADD VALUE 'materials';--> statement-breakpoint
ALTER TYPE "public"."ai_run_kind" ADD VALUE 'taxonomy';--> statement-breakpoint
ALTER TYPE "public"."ai_run_kind" ADD VALUE 'when_made';--> statement-breakpoint
ALTER TYPE "public"."ai_run_kind" ADD VALUE 'translation';--> statement-breakpoint
ALTER TYPE "public"."ai_run_kind" ADD VALUE 'enrich';--> statement-breakpoint
ALTER TYPE "public"."product_status" ADD VALUE 'scheduled' BEFORE 'published';--> statement-breakpoint
ALTER TABLE "etsy_oauth" ADD COLUMN "markup_percent" smallint DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "title_es" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "title_en" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description_es" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "description_en" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "base_price_cents" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "markup_percent_override" smallint;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "list_price_cents_override" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "clothing_type" "clothing_type";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "condition" "product_condition";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sizes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "shoulder_cm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "chest_cm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "waist_cm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "hip_cm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rise_cm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "leg_cm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "length_cm" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "bra_size" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "etsy_tags_es" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "etsy_tags_en" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "etsy_materials_es" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "etsy_materials_en" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "etsy_when_made" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "etsy_taxonomy_id" bigint;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "scheduled_publish_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "products_scheduled_publish_at_idx" ON "products" USING btree ("scheduled_publish_at");--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "price_cents";