import type { Product } from "@/lib/db/schema";

/**
 * Client-safe descriptor of the available story templates — just the key
 * and which product statuses each applies to. Kept free of React /
 * satori / server imports so the dialog (client) and the route (server)
 * can both read it. The server render map lives in `templates/index.ts`.
 *
 * To add a template:
 *   1. add its key to `StoryVariantKey`,
 *   2. add an entry here with the statuses it applies to,
 *   3. add a label under `products.instagramStory.variants.<key>` (i18n),
 *   4. add a renderer in `templates/index.ts`.
 */
export type StoryVariantKey = "new" | "sold";

type ProductStatus = Product["status"];

export type StoryVariant = {
  key: StoryVariantKey;
  /** Product statuses this template is offered for. */
  statuses: readonly ProductStatus[];
};

export const STORY_VARIANTS: readonly StoryVariant[] = [
  // "New today" — live listings only (the English title exists at publish).
  { key: "new", statuses: ["published"] },
  // "Sold" — a just-sold showcase post, offered once the listing sells.
  { key: "sold", statuses: ["sold"] },
];

export const DEFAULT_VARIANT_KEY: StoryVariantKey = "new";

/** Type guard for an untrusted `?variant=` value. */
export function isVariantKey(value: string | null | undefined): value is StoryVariantKey {
  return value != null && STORY_VARIANTS.some((v) => v.key === value);
}

/** Templates offered for a product in the given status. */
export function variantsForStatus(
  status: ProductStatus,
): readonly StoryVariant[] {
  return STORY_VARIANTS.filter((v) => v.statuses.includes(status));
}
