CREATE TYPE "public"."ai_model_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."ai_run_kind" AS ENUM('enrich', 'translation', 'model_generation', 'model_placement', 'field_regenerate');--> statement-breakpoint
CREATE TYPE "public"."ai_run_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."clothing_type" AS ENUM('shirt', 'vest', 'top', 'sweater', 'jacket', 'trench_coat', 'corset', 'jean', 'pant', 'skirt', 'short', 'set', 'overall', 'dress', 'bodysuit');--> statement-breakpoint
CREATE TYPE "public"."image_role" AS ENUM('original', 'ai_model', 'ai_reference', 'thumbnail');--> statement-breakpoint
CREATE TYPE "public"."product_condition" AS ENUM('perfect', 'very_good', 'good');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'scheduled', 'published', 'sold', 'archived');--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text,
	"status" "ai_model_status" DEFAULT 'draft' NOT NULL,
	"age_range" text NOT NULL,
	"body_type" text NOT NULL,
	"height_range" text NOT NULL,
	"skin_tone" text NOT NULL,
	"face_shape" text NOT NULL,
	"hair_color" text NOT NULL,
	"hair_shape" text NOT NULL,
	"hair_type" text NOT NULL,
	"contact_sheet_key" text,
	"front_full_key" text,
	"front_portrait_key" text,
	"front_editorial_key" text,
	"side_portrait_key" text,
	"back_full_key" text,
	"threequarter_full_key" text,
	"crops_available" boolean DEFAULT false NOT NULL,
	"image_quality" text DEFAULT 'low' NOT NULL,
	"ai_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"ai_model_id" uuid,
	"kind" "ai_run_kind" NOT NULL,
	"status" "ai_run_status" DEFAULT 'pending' NOT NULL,
	"model" text,
	"input_json" jsonb,
	"output_json" jsonb,
	"cost_usd" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "clothing_buy_price_defaults" (
	"clothing_type" "clothing_type" PRIMARY KEY NOT NULL,
	"default_buy_price_cents" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etsy_oauth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" bigint NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"scopes" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"shipping_profile_light_id" bigint,
	"shipping_profile_medium_id" bigint,
	"shipping_profile_heavy_id" bigint,
	"default_return_policy_id" bigint,
	"default_readiness_state_id" bigint,
	"markup_percent" smallint DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "etsy_oauth_shop_id_unique" UNIQUE("shop_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"actor" text NOT NULL,
	"type" text NOT NULL,
	"payload_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs_idempotency" (
	"id" text PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"role" "image_role" DEFAULT 'original' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"ai_image_enabled" boolean DEFAULT true NOT NULL,
	"listing_footer_es" text DEFAULT '' NOT NULL,
	"listing_footer_en" text DEFAULT '' NOT NULL,
	"ai_default_model_id" uuid,
	"ai_default_source_panel" text,
	"ai_default_pose_preset" text DEFAULT 'soft_relaxed' NOT NULL,
	"ai_default_framing_preset" text DEFAULT 'waist_up' NOT NULL,
	"ai_default_environment_preset" text DEFAULT 'textured_wall' NOT NULL,
	"ai_default_image_quality" text DEFAULT 'low' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"poster_r2_key" text,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"duration_ms" integer,
	"width" integer,
	"height" integer,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_es" text,
	"title_en" text,
	"description_es" text,
	"description_en" text,
	"base_price_cents" integer,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"markup_percent_override" smallint,
	"list_price_cents_override" integer,
	"discount_percent" smallint,
	"buy_price_cents" integer,
	"comments" text,
	"listing_footer_es_override" text,
	"listing_footer_en_override" text,
	"clothing_type" "clothing_type",
	"condition" "product_condition" DEFAULT 'perfect',
	"size" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"shoulder_cm" real,
	"sleeve_width_cm" real,
	"sleeve_length_cm" real,
	"chest_cm" real,
	"waist_cm" real,
	"hip_cm" real,
	"rise_cm" real,
	"leg_cm" real,
	"length_cm" real,
	"bra_size" text,
	"etsy_tags_es" text[] DEFAULT '{}'::text[] NOT NULL,
	"etsy_tags_en" text[] DEFAULT '{}'::text[] NOT NULL,
	"etsy_materials_es" text[] DEFAULT '{}'::text[] NOT NULL,
	"etsy_materials_en" text[] DEFAULT '{}'::text[] NOT NULL,
	"etsy_when_made" text,
	"etsy_taxonomy_id" bigint,
	"etsy_primary_color" text,
	"etsy_secondary_color" text,
	"shipping_profile_id" bigint,
	"ai_image_enabled" boolean,
	"ai_model_id" uuid,
	"ai_source_panel" text,
	"ai_pose_preset" text DEFAULT 'soft_relaxed' NOT NULL,
	"ai_framing_preset" text DEFAULT 'waist_up' NOT NULL,
	"ai_environment_preset" text DEFAULT 'textured_wall' NOT NULL,
	"ai_fit_override" text,
	"ai_image_quality" text DEFAULT 'low' NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"scheduled_publish_at" timestamp with time zone,
	"etsy_listing_id" bigint,
	"etsy_state" text,
	"etsy_price_cents" integer,
	"etsy_price_synced_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_settings" ADD CONSTRAINT "product_settings_ai_default_model_id_ai_models_id_fk" FOREIGN KEY ("ai_default_model_id") REFERENCES "public"."ai_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_videos" ADD CONSTRAINT "product_videos_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_ai_model_id_ai_models_id_fk" FOREIGN KEY ("ai_model_id") REFERENCES "public"."ai_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_models_status_idx" ON "ai_models" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_models_created_at_idx" ON "ai_models" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_runs_product_idx" ON "ai_runs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "ai_runs_created_at_idx" ON "ai_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_product_idx" ON "events" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id","order");--> statement-breakpoint
CREATE INDEX "product_videos_product_idx" ON "product_videos" USING btree ("product_id","order");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "products_scheduled_publish_at_idx" ON "products" USING btree ("scheduled_publish_at");--> statement-breakpoint
CREATE UNIQUE INDEX "products_etsy_listing_id_idx" ON "products" USING btree ("etsy_listing_id");