ALTER TABLE "products" ADD COLUMN "etsy_price_cents" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "etsy_price_synced_at" timestamp with time zone;