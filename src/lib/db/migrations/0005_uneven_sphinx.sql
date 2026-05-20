CREATE TABLE "clothing_buy_price_defaults" (
	"clothing_type" "clothing_type" PRIMARY KEY NOT NULL,
	"default_buy_price_cents" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "buy_price_cents" integer;