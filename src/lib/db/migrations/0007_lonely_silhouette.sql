-- Model Studio identity refactor.
-- - Drop ethnicity: the focus group is European, hardcoded in the
--   BASE_MODEL_GENERATION template now.
-- - Replace hair_description with three independent axes: color,
--   shape, type. Existing rows lose their hair string (accepted
--   trade-off — the prior values don't map cleanly onto the new
--   axes). New cols are added with empty-string default so the
--   NOT NULL constraint applies cleanly to legacy rows; the
--   default is then dropped so future inserts must supply a value.
ALTER TABLE "ai_models" DROP COLUMN IF EXISTS "ethnicity";--> statement-breakpoint
ALTER TABLE "ai_models" DROP COLUMN IF EXISTS "hair_description";--> statement-breakpoint
ALTER TABLE "ai_models" ADD COLUMN "hair_color" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_models" ADD COLUMN "hair_shape" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_models" ADD COLUMN "hair_type" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_models" ALTER COLUMN "hair_color" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ai_models" ALTER COLUMN "hair_shape" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ai_models" ALTER COLUMN "hair_type" DROP DEFAULT;
