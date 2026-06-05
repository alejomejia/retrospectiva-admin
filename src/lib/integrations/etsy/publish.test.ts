// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type ProductRow = Record<string, unknown> & { id: string; status: string };

const state: {
  products: ProductRow[];
  settings: Array<Record<string, unknown>>;
  videos: Array<Record<string, unknown>>;
  etsyOauth: Array<Record<string, unknown>>;
  imagesForPublish: Array<{ r2Key: string; role: string }>;
  updates: Array<Record<string, unknown>>;
  translationCalls: Array<{ field: string; throwsCount: number }>;
  translationFailsRemaining: Record<string, number>;
  listingCreated: number | null;
  createdPayload: Record<string, unknown> | null;
  featuredListings: Array<{ listing_id: number }>;
  featuredQueried: boolean;
  uploadedImages: Array<{ rank?: number; filename: string }>;
  uploadedVideo: string | null;
  translationUpserted: string | null;
  listingActivated: boolean;
} = {
  products: [],
  settings: [],
  videos: [],
  etsyOauth: [],
  imagesForPublish: [],
  updates: [],
  translationCalls: [],
  translationFailsRemaining: {},
  listingCreated: null,
  createdPayload: null,
  featuredListings: [],
  featuredQueried: false,
  uploadedImages: [],
  uploadedVideo: null,
  translationUpserted: null,
  listingActivated: false,
};

// Sequenced source-table picker. The publish flow performs these
// reads in order: (1) products status guard, (2) etsy_oauth
// singleton (shop config, read before the featured-cap gate),
// (3) products re-read after translation, (4) product_settings
// (listing footer), (5) product_videos.
let selectSeq = 0;
const SELECT_PLAN: Array<keyof typeof state> = [
  "products",
  "etsyOauth",
  "products",
  "settings",
  "videos",
];

function nextRows(): unknown[] {
  const table = SELECT_PLAN[selectSeq++] ?? "products";
  return state[table] as unknown[];
}

vi.mock("@/lib/db/client", () => {
  const buildSelect = () => ({
    from: () => {
      // Defer row resolution to whichever terminal we hit:
      // `.where().limit()`, `.where()` (thenable), or `.limit()` directly.
      let resolved: unknown[] | null = null;
      const resolve = () => {
        if (resolved === null) resolved = nextRows();
        return resolved;
      };
      return {
        where: () => {
          const thenable = Promise.resolve().then(() =>
            resolve(),
          ) as Promise<unknown[]> & {
            limit: (n: number) => Promise<unknown[]>;
          };
          thenable.limit = async (_n: number) => resolve();
          return thenable;
        },
        limit: async (_n: number) => resolve(),
      };
    },
  });
  const update = (_table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: () => {
        state.updates.push(values);
        return Promise.resolve();
      },
    }),
  });
  return { db: { select: buildSelect, update } };
});

vi.mock("@/lib/utils/dev", () => ({
  devGroup: () => ({
    log: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

vi.mock("@/lib/products/etsy-publish-payload", () => ({
  listImagesForEtsyPublish: vi.fn(async () => state.imagesForPublish),
}));

vi.mock("@/lib/integrations/r2/fetch", () => ({
  fetchBytesFromR2: vi.fn(async ({ key }: { key: string }) => ({
    bytes: new Uint8Array([1, 2, 3]),
    contentType: key.endsWith(".mp4") ? "video/mp4" : "image/jpeg",
    contentLength: 3,
  })),
}));

vi.mock("@/lib/integrations/openai/translate", () => ({
  TRANSLATABLE_FIELDS: [
    "titleEs",
    "descriptionEs",
    "etsyTagsEs",
    "etsyMaterialsEs",
  ] as const,
  runTranslation: vi.fn(async (_id: string, field: string) => {
    const remaining = state.translationFailsRemaining[field] ?? 0;
    state.translationCalls.push({ field, throwsCount: remaining });
    if (remaining > 0) {
      state.translationFailsRemaining[field] = remaining - 1;
      throw new Error(`transient ${field}`);
    }
  }),
}));

vi.mock("./listings", () => ({
  createDraftListing: vi.fn(
    async (_shop: number, payload: Record<string, unknown>) => {
      state.listingCreated = 9999;
      state.createdPayload = payload;
      return { listing_id: 9999, state: "draft" };
    },
  ),
  getFeaturedListings: vi.fn(async (_shop: number) => {
    state.featuredQueried = true;
    return state.featuredListings;
  }),
  updateListing: vi.fn(async (_shop: number, _id: number, patch: unknown) => {
    if ((patch as { state?: string }).state === "active") {
      state.listingActivated = true;
    }
    return { listing_id: 9999, state: "active" };
  }),
  uploadListingImage: vi.fn(
    async (
      _shop: number,
      _id: number,
      input: { rank?: number; filename: string },
    ) => {
      state.uploadedImages.push({ rank: input.rank, filename: input.filename });
      return {
        listing_image_id: state.uploadedImages.length,
        rank: input.rank ?? 1,
      };
    },
  ),
  uploadListingVideo: vi.fn(
    async (
      _shop: number,
      _id: number,
      input: { filename: string },
    ) => {
      state.uploadedVideo = input.filename;
      return { video_id: 1, video_state: "active" };
    },
  ),
  upsertListingTranslation: vi.fn(
    async (_shop: number, _id: number, lang: string) => {
      state.translationUpserted = lang;
      return { language: lang };
    },
  ),
}));

const { runScheduledPublish } = await import("./publish");

function baseProduct(): ProductRow {
  return {
    id: "p1",
    status: "scheduled",
    titleEs: "Vestido",
    titleEn: "Dress",
    descriptionEs: "Bonito vestido",
    descriptionEn: "Lovely dress",
    basePriceCents: 10000,
    markupPercentOverride: null,
    listPriceCentsOverride: null,
    etsyTagsEs: ["a"],
    etsyTagsEn: ["a"],
    etsyMaterialsEs: ["cotton"],
    etsyMaterialsEn: ["cotton"],
    etsyWhenMade: "1990s",
    etsyTaxonomyId: 12345,
  };
}

function baseOauth(): Record<string, unknown> {
  return {
    shopId: 777,
    shippingProfileLightId: 101,
    shippingProfileMediumId: 102,
    shippingProfileHeavyId: 103,
    defaultReturnPolicyId: 200,
    defaultReadinessStateId: 300,
    markupPercent: 30,
  };
}

beforeEach(() => {
  selectSeq = 0;
  state.products = [];
  state.settings = [];
  state.videos = [];
  state.etsyOauth = [baseOauth()];
  state.imagesForPublish = [
    { r2Key: "products/2026/05/15/p1/original/a.jpg", role: "original" },
    { r2Key: "products/2026/05/15/p1/original/b.jpg", role: "original" },
  ];
  state.updates = [];
  state.translationCalls = [];
  state.translationFailsRemaining = {};
  state.listingCreated = null;
  state.createdPayload = null;
  state.featuredListings = [];
  state.featuredQueried = false;
  state.uploadedImages = [];
  state.uploadedVideo = null;
  state.translationUpserted = null;
  state.listingActivated = false;
});

describe("runScheduledPublish — skip paths", () => {
  it("skips with reason='missing' when row is gone", async () => {
    state.products = [];
    const result = await runScheduledPublish("p1");
    expect(result).toEqual({ ok: true, skipped: true, reason: "missing" });
  });

  it.each(["archived", "published", "sold"])(
    "skips with reason='status' when status=%s",
    async (status) => {
      state.products = [{ ...baseProduct(), status }];
      const result = await runScheduledPublish("p1");
      expect(result).toMatchObject({ skipped: true, reason: "status" });
      expect(state.listingCreated).toBeNull();
    },
  );
});

describe("runScheduledPublish — translation retry", () => {
  it("retries a transient translation failure and continues", async () => {
    state.products = [baseProduct(), baseProduct()];
    state.translationFailsRemaining = { titleEs: 1 };
    const result = await runScheduledPublish("p1");
    expect(result).toMatchObject({ skipped: false, listingId: 9999 });
    const titleCalls = state.translationCalls.filter(
      (c) => c.field === "titleEs",
    );
    expect(titleCalls).toHaveLength(2);
  });

  it("aborts publish when all translation retries exhaust", async () => {
    state.products = [baseProduct(), baseProduct()];
    state.translationFailsRemaining = { titleEs: 99 };
    await expect(runScheduledPublish("p1")).rejects.toThrow(
      /translation failed after 3 attempts/,
    );
    expect(state.listingCreated).toBeNull();
  });
});

describe("runScheduledPublish — happy path", () => {
  it("creates draft, persists listingId immediately, uploads images, activates when flag on", async () => {
    process.env.ETSY_ACTIVATE_ON_PUBLISH = "true";
    state.products = [baseProduct(), baseProduct()];
    const result = await runScheduledPublish("p1");
    expect(result).toMatchObject({ skipped: false, listingId: 9999 });

    // Updates fired, in order: persist listing_id; then status=published.
    expect(state.updates.length).toBeGreaterThanOrEqual(2);
    expect(state.updates[0]).toMatchObject({
      etsyListingId: 9999,
      etsyState: "draft",
    });
    const finalUpdate = state.updates.at(-1)!;
    expect(finalUpdate).toMatchObject({
      status: "published",
      etsyState: "active",
    });

    expect(state.uploadedImages).toHaveLength(2);
    expect(state.uploadedImages[0]!.rank).toBe(1);
    expect(state.uploadedImages[1]!.rank).toBe(2);
    expect(state.uploadedVideo).toBeNull();
    expect(state.translationUpserted).toBe("es");
    expect(state.listingActivated).toBe(true);
    delete process.env.ETSY_ACTIVATE_ON_PUBLISH;
  });

  it("leaves listing as Etsy draft when ETSY_ACTIVATE_ON_PUBLISH is unset (default)", async () => {
    delete process.env.ETSY_ACTIVATE_ON_PUBLISH;
    state.products = [baseProduct(), baseProduct()];
    await runScheduledPublish("p1");
    const finalUpdate = state.updates.at(-1)!;
    expect(finalUpdate).toMatchObject({
      status: "published",
      etsyState: "draft",
    });
    expect(state.listingActivated).toBe(false);
  });

  it("uploads a video when product has one", async () => {
    state.products = [baseProduct(), baseProduct()];
    state.videos = [
      {
        r2Key: "products/2026/05/15/p1/video/clip.mp4",
        mimeType: "video/mp4",
      },
    ];
    await runScheduledPublish("p1");
    expect(state.uploadedVideo).toBe("video.mp4");
  });

  it("accepts a draft-status product (publishNow path)", async () => {
    state.products = [
      { ...baseProduct(), status: "draft" },
      { ...baseProduct(), status: "draft" },
    ];
    const result = await runScheduledPublish("p1");
    expect(result).toMatchObject({ skipped: false });
  });
});

describe("runScheduledPublish — featured-listing cap", () => {
  it("publishes with featured_rank when shop is under the cap", async () => {
    state.products = [
      { ...baseProduct(), isFeatured: true },
      { ...baseProduct(), isFeatured: true },
    ];
    state.featuredListings = [{ listing_id: 1 }, { listing_id: 2 }];
    const result = await runScheduledPublish("p1");
    expect(result).toMatchObject({ skipped: false, listingId: 9999 });
    expect(state.createdPayload).toMatchObject({ featured_rank: 1 });
  });

  it("publishes unfeatured (strips featured_rank) when shop already has 4 featured", async () => {
    state.products = [
      { ...baseProduct(), isFeatured: true },
      { ...baseProduct(), isFeatured: true },
    ];
    state.featuredListings = [
      { listing_id: 1 },
      { listing_id: 2 },
      { listing_id: 3 },
      { listing_id: 4 },
    ];
    const result = await runScheduledPublish("p1");
    // Scheduled jobs publish anyway — just without the feature flag.
    expect(result).toMatchObject({ skipped: false, listingId: 9999 });
    expect(state.createdPayload).not.toHaveProperty("featured_rank");
  });

  it("does not query Etsy featured listings when the product is not featured", async () => {
    state.products = [baseProduct(), baseProduct()];
    await runScheduledPublish("p1");
    expect(state.featuredQueried).toBe(false);
  });
});
