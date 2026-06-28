ALTER TABLE "products" ADD COLUMN "published_at" timestamp with time zone;
--> statement-breakpoint
-- Backfill: earliest recorded first-publish from the events log.
UPDATE "products" AS p
SET "published_at" = sub.first_publish
FROM (
  SELECT "product_id", MIN("created_at") AS first_publish
  FROM "events"
  WHERE "type" = 'etsy-publish.completed' AND "product_id" IS NOT NULL
  GROUP BY "product_id"
) AS sub
WHERE p."id" = sub."product_id" AND p."published_at" IS NULL;
--> statement-breakpoint
-- Fallback for already-live rows with no publish event (manual/legacy):
-- anchor to creation date so the NEW window has a stable basis.
UPDATE "products"
SET "published_at" = "created_at"
WHERE "published_at" IS NULL AND "status" IN ('published', 'sold', 'archived');
