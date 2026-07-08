-- Purge rows carrying the removed enum members before the enum types are
-- recreated below; the `USING role::image_role` / `kind::ai_run_kind` casts
-- would otherwise fail on any surviving 'ai_model'/'ai_reference'/
-- 'model_generation'/'model_placement' value. (R2 objects for these images
-- are not swept here — a DB migration can't reach the bucket.)
DELETE FROM "product_images" WHERE "role" IN ('ai_model', 'ai_reference');--> statement-breakpoint
DELETE FROM "ai_runs" WHERE "kind" IN ('model_generation', 'model_placement');--> statement-breakpoint
ALTER TABLE "ai_models" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "ai_models" CASCADE;--> statement-breakpoint
ALTER TABLE "product_settings" DROP CONSTRAINT IF EXISTS "product_settings_ai_default_model_id_ai_models_id_fk";
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_ai_model_id_ai_models_id_fk";
--> statement-breakpoint
ALTER TABLE "ai_runs" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."ai_run_kind";--> statement-breakpoint
CREATE TYPE "public"."ai_run_kind" AS ENUM('enrich', 'translation', 'field_regenerate');--> statement-breakpoint
ALTER TABLE "ai_runs" ALTER COLUMN "kind" SET DATA TYPE "public"."ai_run_kind" USING "kind"::"public"."ai_run_kind";--> statement-breakpoint
ALTER TABLE "product_images" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "product_images" ALTER COLUMN "role" SET DEFAULT 'original'::text;--> statement-breakpoint
DROP TYPE "public"."image_role";--> statement-breakpoint
CREATE TYPE "public"."image_role" AS ENUM('original', 'thumbnail');--> statement-breakpoint
ALTER TABLE "product_images" ALTER COLUMN "role" SET DEFAULT 'original'::"public"."image_role";--> statement-breakpoint
ALTER TABLE "product_images" ALTER COLUMN "role" SET DATA TYPE "public"."image_role" USING "role"::"public"."image_role";--> statement-breakpoint
ALTER TABLE "ai_runs" DROP COLUMN "ai_model_id";--> statement-breakpoint
ALTER TABLE "product_settings" DROP COLUMN "ai_image_enabled";--> statement-breakpoint
ALTER TABLE "product_settings" DROP COLUMN "ai_default_model_id";--> statement-breakpoint
ALTER TABLE "product_settings" DROP COLUMN "ai_default_source_panel";--> statement-breakpoint
ALTER TABLE "product_settings" DROP COLUMN "ai_default_pose_preset";--> statement-breakpoint
ALTER TABLE "product_settings" DROP COLUMN "ai_default_framing_preset";--> statement-breakpoint
ALTER TABLE "product_settings" DROP COLUMN "ai_default_environment_preset";--> statement-breakpoint
ALTER TABLE "product_settings" DROP COLUMN "ai_default_image_quality";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "ai_image_enabled";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "ai_model_id";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "ai_source_panel";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "ai_pose_preset";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "ai_framing_preset";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "ai_environment_preset";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "ai_fit_override";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "ai_image_quality";--> statement-breakpoint
DROP TYPE "public"."ai_model_status";