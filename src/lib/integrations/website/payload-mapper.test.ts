// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const state: {
  products: Row[];
  settings: Row[];
  images: Row[];
  videos: Row[];
} = {
  products: [],
  settings: [],
  images: [],
  videos: [],
};

// Sequenced source-table picker. `buildWebsitePayload` reads in
// order: (1) products, (2) product_settings (footer), (3)
// product_images, (4) product_videos.
let selectSeq = 0;
const SELECT_PLAN: Array<keyof typeof state> = [
  "products",
  "settings",
  "images",
  "videos",
];

function nextRows(): unknown[] {
  const table = SELECT_PLAN[selectSeq++] ?? "products";
  return state[table] as unknown[];
}

vi.mock("@/lib/db/client", () => {
  const buildSelect = () => ({
    from: () => {
      let resolved: unknown[] | null = null;
      const resolve = () => {
        if (resolved === null) resolved = nextRows();
        return resolved;
      };
      const chain: Record<string, unknown> = {};
      const thenable = (): Promise<unknown[]> &
        Record<string, (n?: number) => unknown> => {
        const p = Promise.resolve().then(() => resolve()) as Promise<
          unknown[]
        > &
          Record<string, (n?: number) => unknown>;
        p.limit = async () => resolve();
        p.orderBy = () => {
          const p2 = Promise.resolve().then(() => resolve()) as Promise<
            unknown[]
          > &
            Record<string, (n?: number) => unknown>;
          p2.limit = async () => resolve();
          return p2;
        };
        return p;
      };
      chain.where = () => thenable();
      chain.limit = async () => resolve();
      chain.orderBy = () => thenable();
      return chain;
    },
  });
  return { db: { select: buildSelect } };
});

const { buildWebsitePayload, WebsitePayloadError } = await import(
  "./payload-mapper"
);

function baseProduct(overrides: Row = {}): Row {
  return {
    id: "prod-1",
    titleEs: "Camisa vintage",
    titleEn: "Vintage shirt",
    descriptionEs: "Camisa de los 90s",
    descriptionEn: "90s shirt",
    basePriceCents: 5000,
    currency: "EUR",
    markupPercentOverride: null,
    listPriceCentsOverride: null,
    buyPriceCents: 1000,
    clothingType: "shirt",
    condition: "perfect",
    sizes: ["M"],
    shoulderCm: 45,
    chestCm: 50,
    waistCm: null,
    hipCm: null,
    riseCm: null,
    legCm: null,
    lengthCm: 70,
    braSize: null,
    etsyTagsEs: ["vintage", "camisa"],
    etsyTagsEn: ["vintage", "shirt"],
    etsyMaterialsEs: ["algodón"],
    etsyMaterialsEn: ["cotton"],
    etsyWhenMade: "1990s",
    etsyTaxonomyId: 1234,
    status: "published",
    scheduledPublishAt: null,
    etsyListingId: 999_111,
    soldAt: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    updatedAt: new Date("2026-05-10T12:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  selectSeq = 0;
  state.products = [];
  state.settings = [];
  state.images = [];
  state.videos = [];
  process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com";
});

describe("buildWebsitePayload", () => {
  it("emits bilingual title/description/tags/materials", async () => {
    state.products = [baseProduct()];
    state.images = [
      {
        r2Key: "products/2026-05/prod-1/original/a.jpg",
        role: "original",
        order: 0,
        width: 800,
        height: 1200,
      },
    ];
    const out = await buildWebsitePayload({
      productId: "prod-1",
      kind: "publish",
    });
    expect(out.title).toEqual({ es: "Camisa vintage", en: "Vintage shirt" });
    expect(out.description).toEqual({
      es: [
        "Medidas:",
        "- Hombro a hombro: 45cm",
        "- Pecho: Plano 50cm - Contorno 100cm",
        "- Largo: 70cm",
        "",
        "Camisa de los 90s",
      ].join("\n"),
      en: [
        "Measurements:",
        "- Shoulder: 45cm",
        "- Chest: Flat 50cm - Around 100cm",
        "- Length: 70cm",
        "",
        "90s shirt",
      ].join("\n"),
    });
    expect(out.tags).toEqual({
      es: ["vintage", "camisa"],
      en: ["vintage", "shirt"],
    });
    expect(out.materials).toEqual({ es: ["algodón"], en: ["cotton"] });
    expect(out.kind).toBe("publish");
  });

  it("emits the frozen publishedAt, NOT updatedAt (NEW-badge stability)", async () => {
    // Autosave bumps updatedAt; the NEW badge must key off the frozen
    // first-publish timestamp so edits never re-flag a product as new.
    state.products = [
      baseProduct({ publishedAt: new Date("2026-05-03T08:00:00Z") }),
    ];
    const out = await buildWebsitePayload({
      productId: "prod-1",
      kind: "publish",
    });
    expect(out.publishedAt).toBe("2026-05-03T08:00:00.000Z");
    expect(out.publishedAt).not.toBe("2026-05-10T12:00:00.000Z");
  });

  it("falls back to createdAt when publishedAt is unset", async () => {
    state.products = [baseProduct({ publishedAt: null })];
    const out = await buildWebsitePayload({
      productId: "prod-1",
      kind: "publish",
    });
    expect(out.publishedAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("doubles boundary-doubled measurements (shirt → chest only)", async () => {
    state.products = [baseProduct()];
    state.images = [
      {
        r2Key: "k.jpg",
        role: "original",
        order: 0,
        width: null,
        height: null,
      },
    ];
    const out = await buildWebsitePayload({
      productId: "prod-1",
      kind: "publish",
    });
    // shirt doubles only chest. Shoulder + length stay flat. Others stay null.
    expect(out.measurements.chestCm).toBe(100);
    expect(out.measurements.shoulderCm).toBe(45);
    expect(out.measurements.lengthCm).toBe(70);
    expect(out.measurements.waistCm).toBeNull();
    expect(out.measurements.waistMaxCm).toBeNull();
  });

  it("doubles waistMaxCm alongside waistCm for an elastic jean", async () => {
    state.products = [
      baseProduct({ clothingType: "jean", waistCm: 38, waistMaxCm: 44 }),
    ];
    state.images = [
      { r2Key: "k.jpg", role: "original", order: 0, width: null, height: null },
    ];
    const out = await buildWebsitePayload({
      productId: "prod-1",
      kind: "publish",
    });
    expect(out.measurements.waistCm).toBe(76);
    expect(out.measurements.waistMaxCm).toBe(88);
  });

  it("orders images: originals by `order`, then ai_model appended last", async () => {
    state.products = [baseProduct()];
    state.images = [
      { r2Key: "a.jpg", role: "original", order: 1, width: 1, height: 1 },
      { r2Key: "b.jpg", role: "original", order: 0, width: 1, height: 1 },
      { r2Key: "ai.jpg", role: "ai_model", order: 99, width: 1, height: 1 },
    ];
    const out = await buildWebsitePayload({
      productId: "prod-1",
      kind: "publish",
    });
    expect(out.images.map((i) => i.role)).toEqual([
      "original",
      "original",
      "ai_model",
    ]);
    expect(out.images.map((i) => i.url)).toEqual([
      "https://cdn.example.com/b.jpg",
      "https://cdn.example.com/a.jpg",
      "https://cdn.example.com/ai.jpg",
    ]);
    expect(out.images.map((i) => i.rank)).toEqual([1, 2, 3]);
  });

  it("excludes ai_reference role from images", async () => {
    state.products = [baseProduct()];
    state.images = [
      { r2Key: "o.jpg", role: "original", order: 0, width: 1, height: 1 },
      { r2Key: "ref.jpg", role: "ai_reference", order: 1, width: 1, height: 1 },
    ];
    const out = await buildWebsitePayload({
      productId: "prod-1",
      kind: "publish",
    });
    expect(out.images.map((i) => i.role)).toEqual(["original"]);
  });

  it("computes effective list price from base + 30% default markup", async () => {
    state.products = [baseProduct({ basePriceCents: 1000 })];
    state.images = [
      { r2Key: "a.jpg", role: "original", order: 0, width: 1, height: 1 },
    ];
    const out = await buildWebsitePayload({
      productId: "prod-1",
      kind: "publish",
    });
    expect(out.listPriceCents).toBe(1300);
  });

  it("omits compare-at price when no discount is set", async () => {
    state.products = [baseProduct({ basePriceCents: 1000 })];
    state.images = [
      { r2Key: "a.jpg", role: "original", order: 0, width: 1, height: 1 },
    ];
    const out = await buildWebsitePayload({
      productId: "prod-1",
      kind: "publish",
    });
    expect(out.discountPercent).toBeNull();
    expect(out.compareAtPriceCents).toBeNull();
  });

  it("emits compare-at price and percent when a discount is set", async () => {
    // base 1000 + 30% = 1300 list. 1300 / 0.75 = 1733.3 → charm 1799.
    state.products = [baseProduct({ basePriceCents: 1000, discountPercent: 25 })];
    state.images = [
      { r2Key: "a.jpg", role: "original", order: 0, width: 1, height: 1 },
    ];
    const out = await buildWebsitePayload({
      productId: "prod-1",
      kind: "publish",
    });
    expect(out.listPriceCents).toBe(1300);
    expect(out.discountPercent).toBe(25);
    expect(out.compareAtPriceCents).toBe(1799);
  });

  it("uses explicit list_price_cents_override when set", async () => {
    state.products = [
      baseProduct({ basePriceCents: 1000, listPriceCentsOverride: 1500 }),
    ];
    state.images = [
      { r2Key: "a.jpg", role: "original", order: 0, width: 1, height: 1 },
    ];
    const out = await buildWebsitePayload({
      productId: "prod-1",
      kind: "publish",
    });
    expect(out.listPriceCents).toBe(1500);
  });

  it("emits video block when product has one", async () => {
    state.products = [baseProduct()];
    state.images = [
      { r2Key: "a.jpg", role: "original", order: 0, width: 1, height: 1 },
    ];
    state.videos = [
      {
        r2Key: "v.mp4",
        posterR2Key: "p.webp",
        mimeType: "video/mp4",
        width: 1080,
        height: 1920,
        durationMs: 5000,
      },
    ];
    const out = await buildWebsitePayload({
      productId: "prod-1",
      kind: "publish",
    });
    expect(out.video).toEqual({
      url: "https://cdn.example.com/v.mp4",
      posterUrl: "https://cdn.example.com/p.webp",
      mimeType: "video/mp4",
      width: 1080,
      height: 1920,
      durationMs: 5000,
    });
  });

  it("throws when product is missing", async () => {
    state.products = [];
    state.images = [];
    state.videos = [];
    await expect(
      buildWebsitePayload({ productId: "prod-missing", kind: "publish" }),
    ).rejects.toBeInstanceOf(WebsitePayloadError);
  });

  it("throws when bilingual titles are incomplete", async () => {
    state.products = [baseProduct({ titleEn: "" })];
    await expect(
      buildWebsitePayload({ productId: "prod-1", kind: "publish" }),
    ).rejects.toThrow(/bilingual/);
  });

  it("throws when etsy_listing_id is null (cannot deep-link)", async () => {
    state.products = [baseProduct({ etsyListingId: null })];
    await expect(
      buildWebsitePayload({ productId: "prod-1", kind: "publish" }),
    ).rejects.toThrow(/etsy_listing_id/);
  });
});
