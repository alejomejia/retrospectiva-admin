CREATE TYPE "public"."video_status" AS ENUM('processing', 'ready', 'failed');--> statement-breakpoint
ALTER TABLE "product_videos" ALTER COLUMN "r2_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_videos" ALTER COLUMN "mime_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_videos" ALTER COLUMN "size_bytes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_videos" ADD COLUMN "status" "video_status" DEFAULT 'processing' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_videos" ADD COLUMN "raw_r2_key" text;--> statement-breakpoint
ALTER TABLE "product_videos" ADD COLUMN "error" text;--> statement-breakpoint
-- Backfill: every pre-existing row already holds a transcoded MP4 (r2_key
-- was NOT NULL before this migration), so it is 'ready', not 'processing'.
UPDATE "product_videos" SET "status" = 'ready' WHERE "r2_key" IS NOT NULL;