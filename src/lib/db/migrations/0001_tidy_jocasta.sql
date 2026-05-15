CREATE TABLE "product_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"poster_r2_key" text,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"duration_ms" integer,
	"width" integer,
	"height" integer,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_videos" ADD CONSTRAINT "product_videos_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_videos_product_idx" ON "product_videos" USING btree ("product_id","order");--> statement-breakpoint
ALTER TABLE "product_images" DROP COLUMN "keep_on_sale";