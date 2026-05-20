-- Panel 3 (top-right) was repurposed from "left side profile full
-- body" to "front-facing waist-up editorial close-up". Rename the
-- column to match — existing R2 keys (still named `side_full.png`
-- on disk) stay pointed-to via the renamed column.
ALTER TABLE "ai_models" RENAME COLUMN "side_full_key" TO "front_editorial_key";
