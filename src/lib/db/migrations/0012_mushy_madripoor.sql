ALTER TYPE "public"."image_role" ADD VALUE 'ai_reference' BEFORE 'thumbnail';--> statement-breakpoint
ALTER TABLE "ai_runs" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
-- Drop legacy ai_runs rows whose `kind` was replaced by the unified
-- `enrich` kind. Dev-phase cleanup; no production data to preserve
-- (see docs/per-product-image-gen.md "Schema").
DELETE FROM "ai_runs" WHERE "kind" IN ('description', 'era', 'title', 'tags', 'materials', 'taxonomy', 'when_made');--> statement-breakpoint
DROP TYPE "public"."ai_run_kind";--> statement-breakpoint
CREATE TYPE "public"."ai_run_kind" AS ENUM('enrich', 'translation', 'model_generation', 'model_placement');--> statement-breakpoint
ALTER TABLE "ai_runs" ALTER COLUMN "kind" SET DATA TYPE "public"."ai_run_kind" USING "kind"::"public"."ai_run_kind";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ai_model_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ai_source_panel" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ai_pose_preset" text DEFAULT 'soft_relaxed' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ai_framing_preset" text DEFAULT 'waist_up' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ai_environment_preset" text DEFAULT 'textured_wall' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ai_fit_override" text;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_ai_model_id_ai_models_id_fk" FOREIGN KEY ("ai_model_id") REFERENCES "public"."ai_models"("id") ON DELETE set null ON UPDATE no action;