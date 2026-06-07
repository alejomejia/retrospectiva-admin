import {
  getPropertiesByTaxonomyId,
  updateListingProperty,
  type TaxonomyProperty,
  type TaxonomyPropertyValue,
} from "./listings";

/**
 * Etsy attributes (color, size) are NOT writable on the
 * create/update-listing payload — they're "listing properties" set
 * via a separate per-property endpoint, and the property/value/scale
 * ids depend on the listing's taxonomy. This module resolves our
 * stored strings (`etsy_primary_color`, `size`, …) into the
 * `value_id` / `scale_id` pairs Etsy requires and applies them after
 * the draft exists.
 *
 * The whole step is best-effort: a missing property or an
 * unmatched value is logged and skipped rather than failing the
 * publish, because the listing itself is already valid without the
 * attribute (it just shows up unfiltered in Etsy's color/size
 * facets).
 */

/** Loose match: case-, space-, and underscore-insensitive. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[\s_-]+/g, "");
}

function findProperty(
  properties: TaxonomyProperty[],
  candidates: string[],
): TaxonomyProperty | undefined {
  const wanted = candidates.map(norm);
  return properties.find(
    (p) =>
      wanted.includes(norm(p.name)) || wanted.includes(norm(p.display_name)),
  );
}

function findValueByName(
  values: TaxonomyPropertyValue[],
  name: string,
): TaxonomyPropertyValue | undefined {
  const target = norm(name);
  return values.find((v) => norm(v.name) === target);
}

/**
 * Pick the women's US-letter sizing scale. Etsy exposes several size
 * scales per taxonomy (Women's, Men's, numeric, …); the shop only
 * ever sells women's letter sizes (XS/S/M/…), so prefer a scale whose
 * name mentions "women", then fall back to the first available scale.
 */
function pickWomensLetterScale(property: TaxonomyProperty) {
  const scales = property.scales ?? [];
  return (
    scales.find((s) => norm(s.display_name).includes("women")) ??
    scales[0] ??
    undefined
  );
}

export type ListingAttributeInputs = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  size?: string | null;
};

export type ApplyListingPropertiesDeps = {
  getProperties: typeof getPropertiesByTaxonomyId;
  updateProperty: typeof updateListingProperty;
  warn?: (...args: unknown[]) => void;
};

const defaultDeps: ApplyListingPropertiesDeps = {
  getProperties: getPropertiesByTaxonomyId,
  updateProperty: updateListingProperty,
};

/**
 * Resolve and set the color + size attributes on a freshly-created
 * listing. Never throws — each attribute is applied independently and
 * failures are reported to `warn` so a single unmatched value can't
 * abort the publish.
 *
 * @returns the attribute keys that were successfully applied.
 */
export async function applyListingProperties(
  shopId: number,
  listingId: number,
  taxonomyId: number,
  attrs: ListingAttributeInputs,
  deps: ApplyListingPropertiesDeps = defaultDeps,
): Promise<string[]> {
  const warn = deps.warn ?? (() => {});
  const applied: string[] = [];

  let properties: TaxonomyProperty[];
  try {
    properties = await deps.getProperties(taxonomyId);
  } catch (err) {
    warn("listing properties: taxonomy lookup failed", taxonomyId, err);
    return applied;
  }

  const colorTargets: Array<{
    key: string;
    value: string | null | undefined;
    names: string[];
  }> = [
    {
      key: "primaryColor",
      value: attrs.primaryColor,
      names: ["primary_color", "Primary color", "color"],
    },
    {
      key: "secondaryColor",
      value: attrs.secondaryColor,
      names: ["secondary_color", "Secondary color"],
    },
  ];

  for (const target of colorTargets) {
    const value = (target.value ?? "").trim();
    if (!value) continue;
    const property = findProperty(properties, target.names);
    if (!property) {
      warn(`listing properties: no ${target.key} property on taxonomy`);
      continue;
    }
    const match = findValueByName(property.possible_values ?? [], value);
    if (!match) {
      warn(`listing properties: ${target.key} "${value}" not in Etsy vocab`);
      continue;
    }
    try {
      await deps.updateProperty(shopId, listingId, property.property_id, {
        values: [match.name],
        valueIds: [match.value_id],
      });
      applied.push(target.key);
    } catch (err) {
      warn(`listing properties: ${target.key} update failed`, err);
    }
  }

  const size = (attrs.size ?? "").trim();
  if (size) {
    const property = findProperty(properties, ["size", "Size", "sizing"]);
    if (!property) {
      warn("listing properties: no size property on taxonomy");
    } else {
      const scale = pickWomensLetterScale(property);
      // Some taxonomies tag each value with the scale it belongs to;
      // when present, restrict matching to the chosen scale.
      const candidates = (property.possible_values ?? []).filter(
        (v) =>
          v.scale_id == null ||
          scale == null ||
          v.scale_id === scale.scale_id,
      );
      const match = findValueByName(candidates, size);
      if (!match) {
        warn(`listing properties: size "${size}" not in Etsy vocab`);
      } else {
        try {
          await deps.updateProperty(shopId, listingId, property.property_id, {
            values: [match.name],
            valueIds: [match.value_id],
            scaleId: scale?.scale_id,
          });
          applied.push("size");
        } catch (err) {
          warn("listing properties: size update failed", err);
        }
      }
    }
  }

  return applied;
}
