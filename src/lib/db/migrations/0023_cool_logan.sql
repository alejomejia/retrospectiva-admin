ALTER TABLE "product_settings" ADD COLUMN "listing_footer_es" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "listing_footer_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "listing_footer_es_override" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "listing_footer_en_override" text;