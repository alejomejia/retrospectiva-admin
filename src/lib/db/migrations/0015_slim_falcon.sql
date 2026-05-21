ALTER TABLE "product_settings" ADD COLUMN "ai_default_model_id" uuid;--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "ai_default_source_panel" text;--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "ai_default_pose_preset" text DEFAULT 'soft_relaxed' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "ai_default_framing_preset" text DEFAULT 'waist_up' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "ai_default_environment_preset" text DEFAULT 'textured_wall' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "ai_default_image_quality" text DEFAULT 'low' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_settings" ADD CONSTRAINT "product_settings_ai_default_model_id_ai_models_id_fk" FOREIGN KEY ("ai_default_model_id") REFERENCES "public"."ai_models"("id") ON DELETE set null ON UPDATE no action;