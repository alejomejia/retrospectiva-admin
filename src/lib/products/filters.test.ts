import { describe, expect, it } from "vitest";

import {
  buildProductsWhere,
  DEFAULT_PAGE_SIZE,
  DEFAULT_TAB,
  parseProductListParams,
} from "./filters";

describe("parseProductListParams", () => {
  it("returns defaults when search params are empty", () => {
    const p = parseProductListParams({});
    expect(p.tab).toBe(DEFAULT_TAB);
    expect(p.q).toBeUndefined();
    expect(p.priceMinCents).toBeUndefined();
    expect(p.priceMaxCents).toBeUndefined();
    expect(p.from).toBeUndefined();
    expect(p.to).toBeUndefined();
    expect(p.page).toBe(1);
    expect(p.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("accepts a valid tab and falls back on an invalid one", () => {
    expect(parseProductListParams({ tab: "scheduled" }).tab).toBe("scheduled");
    expect(parseProductListParams({ tab: "nope" }).tab).toBe(DEFAULT_TAB);
  });

  it("trims and drops empty search strings", () => {
    expect(parseProductListParams({ q: "  vestido  " }).q).toBe("vestido");
    expect(parseProductListParams({ q: "   " }).q).toBeUndefined();
  });

  it("converts EUR to cents for price filters", () => {
    const p = parseProductListParams({ priceMin: "10", priceMax: "80.50" });
    expect(p.priceMinCents).toBe(1_000);
    expect(p.priceMaxCents).toBe(8_050);
  });

  it("ignores malformed price inputs", () => {
    const p = parseProductListParams({ priceMin: "abc", priceMax: "-5" });
    expect(p.priceMinCents).toBeUndefined();
    expect(p.priceMaxCents).toBeUndefined();
  });

  it("parses ISO dates", () => {
    const p = parseProductListParams({
      from: "2026-01-01",
      to: "2026-05-17",
    });
    expect(p.from?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(p.to?.toISOString().slice(0, 10)).toBe("2026-05-17");
  });

  it("clamps page to >= 1", () => {
    expect(parseProductListParams({ page: "0" }).page).toBe(1);
    expect(parseProductListParams({ page: "-3" }).page).toBe(1);
    expect(parseProductListParams({ page: "abc" }).page).toBe(1);
    expect(parseProductListParams({ page: "4" }).page).toBe(4);
  });

  it("clamps pageSize to a supported value", () => {
    expect(parseProductListParams({ pageSize: "10" }).pageSize).toBe(10);
    expect(parseProductListParams({ pageSize: "20" }).pageSize).toBe(20);
    expect(parseProductListParams({ pageSize: "50" }).pageSize).toBe(50);
    expect(parseProductListParams({ pageSize: "999" }).pageSize).toBe(
      DEFAULT_PAGE_SIZE,
    );
  });
});

describe("buildProductsWhere", () => {
  it("always emits a status clause for the default tab", () => {
    const out = buildProductsWhere({
      tab: "drafts",
      q: undefined,
      priceMinCents: undefined,
      priceMaxCents: undefined,
      from: undefined,
      to: undefined,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    expect(out).toBeDefined();
  });

  it("returns a SQL when a search term is provided", () => {
    const out = buildProductsWhere({
      tab: "published",
      q: "vestido",
      priceMinCents: undefined,
      priceMaxCents: undefined,
      from: undefined,
      to: undefined,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    expect(out).toBeDefined();
  });

  it("returns a SQL when price + date filters are set", () => {
    const out = buildProductsWhere({
      tab: "drafts",
      q: undefined,
      priceMinCents: 1_000,
      priceMaxCents: 5_000,
      from: new Date("2026-01-01"),
      to: new Date("2026-05-17"),
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    expect(out).toBeDefined();
  });
});
