import { loadEnvConfig } from "@next/env";

// Load .env.local before importing modules that read process.env.
loadEnvConfig(process.cwd());

/**
 * One-shot fetch of Etsy's seller taxonomy tree. Walks the full tree
 * and resolves the taxonomy_id for each curated key in
 * `src/lib/integrations/etsy/taxonomy.ts` so the placeholder zeros
 * can be backfilled before Phase 4c smoke-tests.
 *
 * Run with:
 *
 *   pnpm exec tsx scripts/fetch-etsy-taxonomy.ts
 *
 * Output: prints a ready-to-paste ETSY_TAXONOMIES array. The matcher
 * walks the Vintage > Women branch of the tree and matches each
 * curated `key` against the node's full path by name. Any unresolved
 * key is reported so you can refine the match.
 *
 * No DB / no OAuth tokens required — this hits Etsy's PUBLIC taxonomy
 * endpoint which only needs the app `x-api-key` header.
 */

type TaxonomyNode = {
  id: number;
  level: number;
  name: string;
  parent_id: number | null;
  children: TaxonomyNode[];
  full_path_taxonomy_ids: number[];
};

type CuratedKey = {
  key: string;
  /** Path segments to match (case-insensitive, partial allowed). */
  pathContains: string[];
};

/**
 * Curated keys aligned with `src/lib/integrations/etsy/taxonomy.ts`.
 * `pathContains` is matched against the full node path (root → leaf)
 * in order — every segment must appear somewhere along the chain.
 * Picked to bias toward the **Vintage** subtree where applicable,
 * falling back to current-clothing where Etsy lacks a vintage node.
 */
const CURATED: CuratedKey[] = [
  { key: "womens_dresses", pathContains: ["Vintage", "Dresses"] },
  { key: "womens_skirts", pathContains: ["Vintage", "Skirts"] },
  { key: "womens_tops_and_tees", pathContains: ["Vintage", "Tops"] },
  { key: "womens_sweaters", pathContains: ["Vintage", "Sweaters"] },
  { key: "womens_jackets_and_coats", pathContains: ["Vintage", "Coats"] },
  { key: "womens_pants", pathContains: ["Vintage", "Pants"] },
  { key: "womens_jeans", pathContains: ["Vintage", "Jeans"] },
  { key: "womens_shorts", pathContains: ["Vintage", "Shorts"] },
  {
    key: "womens_jumpsuits_and_rompers",
    pathContains: ["Vintage", "Jumpsuits"],
  },
  { key: "womens_bodysuits", pathContains: ["Vintage", "Bodysuits"] },
  { key: "womens_intimates_corsets", pathContains: ["Vintage", "Corsets"] },
  { key: "womens_outerwear_trench", pathContains: ["Vintage", "Trench"] },
  { key: "womens_clothing_sets", pathContains: ["Vintage", "Sets"] },
];

function walk(
  nodes: TaxonomyNode[],
  parentPath: string[],
  out: Array<{ id: number; path: string[] }>,
): void {
  for (const n of nodes) {
    const path = [...parentPath, n.name];
    out.push({ id: n.id, path });
    if (n.children && n.children.length > 0) walk(n.children, path, out);
  }
}

function findBest(
  flat: Array<{ id: number; path: string[] }>,
  contains: string[],
): { id: number; path: string[] } | null {
  const matches = flat.filter((node) => {
    const joined = node.path.join(" > ").toLowerCase();
    return contains.every((segment) =>
      joined.includes(segment.toLowerCase()),
    );
  });
  if (matches.length === 0) return null;
  // Prefer the deepest match (most specific leaf).
  matches.sort((a, b) => b.path.length - a.path.length);
  return matches[0]!;
}

async function main() {
  const clientId = process.env.ETSY_CLIENT_ID;
  const clientSecret = process.env.ETSY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("ETSY_CLIENT_ID / ETSY_CLIENT_SECRET not set");
    process.exit(1);
  }

  const res = await fetch(
    "https://openapi.etsy.com/v3/application/seller-taxonomy/nodes",
    {
      headers: { "x-api-key": `${clientId}:${clientSecret}` },
    },
  );
  if (!res.ok) {
    console.error(
      `Etsy taxonomy fetch failed: ${res.status} ${await res.text()}`,
    );
    process.exit(1);
  }
  const json = (await res.json()) as {
    count: number;
    results: TaxonomyNode[];
  };

  const flat: Array<{ id: number; path: string[] }> = [];
  walk(json.results, [], flat);
  console.error(`# fetched ${flat.length} taxonomy nodes`);

  const resolved: Array<{ key: string; id: number; path: string }> = [];
  const unresolved: string[] = [];

  for (const c of CURATED) {
    const match = findBest(flat, c.pathContains);
    if (!match) {
      unresolved.push(c.key);
      continue;
    }
    resolved.push({
      key: c.key,
      id: match.id,
      path: match.path.join(" > "),
    });
  }

  console.error("\n# resolved:");
  for (const r of resolved) {
    console.error(`  ${r.key.padEnd(32)} ${String(r.id).padEnd(8)} ${r.path}`);
  }

  if (unresolved.length > 0) {
    console.error("\n# UNRESOLVED (refine pathContains in script):");
    for (const k of unresolved) console.error(`  ${k}`);
  }

  console.log("\n// paste into src/lib/integrations/etsy/taxonomy.ts");
  console.log("export const ETSY_TAXONOMIES: EtsyTaxonomyEntry[] = [");
  for (const c of CURATED) {
    const r = resolved.find((x) => x.key === c.key);
    const id = r ? r.id : 0;
    console.log(`  { key: "${c.key}", id: ${id} },`);
  }
  console.log("];");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
