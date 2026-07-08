import { and, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

import { products, type ProductStatus } from "@/lib/db/schema";

/**
 * Filter + tab + pagination state for the /products list view.
 *
 * State is encoded in URL `searchParams`; the page is a server
 * component that calls `parseProductListParams(searchParams)` then
 * `buildProductsWhere(params)` to assemble the Drizzle WHERE clause.
 *
 * Tabs are the only status switcher. The visible filters are
 * driven by `PRODUCT_FILTERS`; appending an entry there + a branch
 * in `buildProductsWhere` is all it takes to add a new filter.
 */

export const STATUS_TABS = [
  "drafts",
  "published",
  "scheduled",
  "archived",
] as const;
export type StatusTab = (typeof STATUS_TABS)[number];

export const DEFAULT_TAB: StatusTab = "drafts";

/** Which DB statuses each tab unions over. */
export const STATUS_TABS_FILTER: Record<StatusTab, ProductStatus[]> = {
  drafts: ["draft"],
  published: ["published"],
  scheduled: ["scheduled"],
  archived: ["archived", "sold"],
};

/**
 * Filter definition. Display labels live in
 * `m.products.filters.{key}Label` — looked up by the consumer so
 * the registry stays English-only.
 */
export type FilterDefinition =
  | { key: "price"; type: "number-range" }
  | { key: "createdAt"; type: "date-range" };

/** Visible filters on /products. Extend here to add more. */
export const PRODUCT_FILTERS: FilterDefinition[] = [
  { key: "price", type: "number-range" },
  { key: "createdAt", type: "date-range" },
];

export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 20;
export type PageSize = (typeof PAGE_SIZES)[number];

export type ProductListParams = {
  tab: StatusTab;
  q: string | undefined;
  /** Cents — derived from the user-facing EUR input. */
  priceMinCents: number | undefined;
  priceMaxCents: number | undefined;
  from: Date | undefined;
  to: Date | undefined;
  page: number;
  pageSize: PageSize;
};

function clampPage(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function clampPageSize(raw: unknown): PageSize {
  const n = Number(raw);
  return (PAGE_SIZES as readonly number[]).includes(n)
    ? (n as PageSize)
    : DEFAULT_PAGE_SIZE;
}

function parseDate(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parsePositiveNumber(raw: unknown): number | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Parses the URL search params into a normalized
 * `ProductListParams`. Unknown / malformed values fall back to
 * sensible defaults.
 */
export function parseProductListParams(
  sp: Record<string, string | string[] | undefined>,
): ProductListParams {
  const tabRaw = typeof sp.tab === "string" ? sp.tab : DEFAULT_TAB;
  const tab = (STATUS_TABS as readonly string[]).includes(tabRaw)
    ? (tabRaw as StatusTab)
    : DEFAULT_TAB;

  const qRaw = typeof sp.q === "string" ? sp.q.trim() : "";
  const q = qRaw.length > 0 ? qRaw : undefined;

  const priceMinEur = parsePositiveNumber(sp.priceMin);
  const priceMaxEur = parsePositiveNumber(sp.priceMax);
  const priceMinCents =
    priceMinEur !== undefined ? Math.round(priceMinEur * 100) : undefined;
  const priceMaxCents =
    priceMaxEur !== undefined ? Math.round(priceMaxEur * 100) : undefined;

  return {
    tab,
    q,
    priceMinCents,
    priceMaxCents,
    from: parseDate(sp.from),
    to: parseDate(sp.to),
    page: clampPage(sp.page),
    pageSize: clampPageSize(sp.pageSize),
  };
}

/**
 * Assembles the Drizzle WHERE clause for the products list query
 * from the parsed params. Returns `undefined` when no filtering is
 * needed (caller should treat as "no WHERE clause").
 */
export function buildProductsWhere(
  params: ProductListParams,
): SQL | undefined {
  const clauses: SQL[] = [];

  const allowed = STATUS_TABS_FILTER[params.tab];
  if (allowed.length === 1) {
    clauses.push(sql`${products.status} = ${allowed[0]}`);
  } else if (allowed.length > 1) {
    clauses.push(inArray(products.status, allowed));
  }

  if (params.q) {
    // unaccent ILIKE — accent-insensitive case-insensitive substring.
    const like = `%${params.q}%`;
    // Search the canonical English title, falling back to the derived
    // Spanish for legacy rows that predate the English-first flip.
    clauses.push(
      sql`unaccent(coalesce(${products.titleEn}, ${products.titleEs}, '')) ILIKE unaccent(${like})`,
    );
  }

  if (params.priceMinCents !== undefined) {
    clauses.push(gte(products.basePriceCents, params.priceMinCents));
  }
  if (params.priceMaxCents !== undefined) {
    clauses.push(lte(products.basePriceCents, params.priceMaxCents));
  }

  if (params.from) {
    clauses.push(gte(products.createdAt, params.from));
  }
  if (params.to) {
    clauses.push(lte(products.createdAt, params.to));
  }

  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0];
  return and(...clauses);
}
