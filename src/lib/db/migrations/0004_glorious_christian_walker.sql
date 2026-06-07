ALTER TABLE "products" ADD COLUMN "slug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");