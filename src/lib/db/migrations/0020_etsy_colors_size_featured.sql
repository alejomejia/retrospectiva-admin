ALTER TABLE "products" ADD COLUMN "size" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "etsy_primary_color" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "etsy_secondary_color" text;--> statement-breakpoint
UPDATE "products" SET "size" = "sizes"[1] WHERE array_length("sizes", 1) >= 1;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "sizes";
