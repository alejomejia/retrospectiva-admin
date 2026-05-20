CREATE TYPE "public"."ai_model_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
ALTER TYPE "public"."ai_run_kind" ADD VALUE 'model_generation';--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text,
	"status" "ai_model_status" DEFAULT 'draft' NOT NULL,
	"age_range" text NOT NULL,
	"ethnicity" text NOT NULL,
	"body_type" text NOT NULL,
	"height_range" text NOT NULL,
	"skin_tone" text NOT NULL,
	"face_shape" text NOT NULL,
	"hair_description" text NOT NULL,
	"contact_sheet_key" text,
	"front_full_key" text,
	"front_portrait_key" text,
	"side_full_key" text,
	"side_portrait_key" text,
	"back_full_key" text,
	"threequarter_full_key" text,
	"crops_available" boolean DEFAULT false NOT NULL,
	"ai_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_runs" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD COLUMN "ai_model_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_models_status_idx" ON "ai_models" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_models_created_at_idx" ON "ai_models" USING btree ("created_at");