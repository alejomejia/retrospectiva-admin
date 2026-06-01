ALTER TABLE "etsy_oauth" ADD COLUMN "shipping_profile_light_id" bigint;--> statement-breakpoint
ALTER TABLE "etsy_oauth" ADD COLUMN "shipping_profile_medium_id" bigint;--> statement-breakpoint
ALTER TABLE "etsy_oauth" ADD COLUMN "shipping_profile_heavy_id" bigint;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "shipping_profile_id" bigint;--> statement-breakpoint
ALTER TABLE "etsy_oauth" DROP COLUMN "default_shipping_profile_id";
