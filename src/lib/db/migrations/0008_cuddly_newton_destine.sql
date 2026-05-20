ALTER TABLE "ai_models" ADD COLUMN "hair_color" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_models" ADD COLUMN "hair_shape" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_models" ADD COLUMN "hair_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_models" DROP COLUMN "ethnicity";--> statement-breakpoint
ALTER TABLE "ai_models" DROP COLUMN "hair_description";