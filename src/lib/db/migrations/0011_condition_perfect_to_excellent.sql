-- Rename the 'perfect' condition to 'excellent'. RENAME VALUE preserves the
-- enum's internal ordinal, so existing rows and the column default carry over
-- to the new label automatically (no data rewrite, no cast).
ALTER TYPE "public"."product_condition" RENAME VALUE 'perfect' TO 'excellent';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "condition" SET DEFAULT 'excellent';
