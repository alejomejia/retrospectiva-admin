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
  existingImages: Array<{ listing_image_id: number }>;
  existingVideos: Array<{ video_id: number }>;
  deletedImageIds: number[];
  deletedVideoIds: number[];
  uploadedImages: Array<{ rank?: number }>;
  uploadedVideo: string | null;
  reorderImageIds: number[] | null;
  listingPatches: Array<Record<string, unknown>>;
  translationUpserted: string | null;
  webhookAdds: Array<{ name: string; opts: unknown }>;
  featuredListings: Array<{ listing_id: number }>;
} = {
  products: [],
  settings: [],
  videos: [],
  etsyOauth: [],
  imagesForPublish: [],
  updates: [],
  existingImages: [],
  existingVideos: [],
  deletedImageIds: [],
  deletedVideoIds: [],
  uploadedImages: [],
  uploadedVideo: null,
  reorderImageIds: null,
  listingPatches: [],
  translationUpserted: null,
  webhookAdds: [],
  featuredListings: [],
};

// Read order: products guard, etsy_oauth (shop config, before the
// featured-cap gate), products re-read, product_settings (footer),
// videos.
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
  devGroup: () => ({ log: () => {}, warn: () => {}, error: () => {} }),
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
  runTranslation: vi.fn(async () => {}),
}));

vi.mock("@/lib/queue/queues", () => ({
  websiteWebhookQueue: {
    add: vi.fn(async (name: string, _data: unknown, opts: unknown) => {
      state.webhookAdds.push({ name, opts });
    }),
  },
}));

vi.mock("./listings", () => ({
  updateListing: vi.fn(
    async (_shop: number, _id: number, patch: Record<string, unknown>) => {
      if (Array.isArray(patch.image_ids)) {
        state.reorderImageIds = patch.image_ids as number[];
      } else {
        state.listingPatches.push(patch);
      }
      return { listing_id: 9999, state: "active" };
    },
  ),
  listListingImages: vi.fn(async () => state.existingImages),
  deleteListingImage: vi.fn(async (_s: number, _l: number, id: number) => {
    state.deletedImageIds.push(id);
  }),
  uploadListingImage: vi.fn(
    async (_s: number, _l: number, input: { rank?: number }) => {
      state.uploadedImages.push({ rank: input.rank });
      return { listing_image_id: state.uploadedImages.length, rank: input.rank ?? 1 };
    },
  ),
  listListingVideos: vi.fn(async () => state.existingVideos),
  deleteListingVideo: vi.fn(async (_s: number, _l: number, id: number) => {
    state.deletedVideoIds.push(id);
  }),
  uploadListingVideo: vi.fn(async (_s: number, _l: number, input: { filename: string }) => {
    state.uploadedVideo = input.filename;
    return { video_id: 1, video_state: "active" };
  }),
  upsertListingTranslation: vi.fn(async (_s: number, _l: number, lang: string) => {
    state.translationUpserted = lang;
    return { language: lang };
  }),
  getFeaturedListings: vi.fn(async (_shop: number) => state.featuredListings),
}));

const { runEtsyListingUpdate } = await import("./update");

function baseProduct(): ProductRow {
  return {
    id: "p1",
    status: "published",
    etsyListingId: 9999,
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
    shippingProfileId: 101,
  };
}

function baseOauth(): Record<string, unknown> {
  return {
    shopId: 777,
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
  state.existingImages = [{ listing_image_id: 11 }, { listing_image_id: 12 }];
  state.existingVideos = [];
  state.deletedImageIds = [];
  state.deletedVideoIds = [];
  state.uploadedImages = [];
  state.uploadedVideo = null;
  state.reorderImageIds = null;
  state.listingPatches = [];
  state.translationUpserted = null;
  state.webhookAdds = [];
  state.featuredListings = [];
});

describe("runEtsyListingUpdate — skip paths", () => {
  it("skips with reason='missing' when row is gone", async () => {
    state.products = [];
    const res = await runEtsyListingUpdate("p1");
    expect(res).toEqual({ ok: true, skipped: true, reason: "missing" });
  });

  it.each(["draft", "archived", "sold"])(
    "skips with reason='status' when status=%s",
    async (status) => {
      state.products = [{ ...baseProduct(), status }];
      const res = await runEtsyListingUpdate("p1");
      expect(res).toMatchObject({ skipped: true, reason: "status" });
      expect(state.listingPatches).toHaveLength(0);
    },
  );

  it("skips with reason='no_listing_id' when etsyListingId is null", async () => {
    state.products = [{ ...baseProduct(), etsyListingId: null }];
    const res = await runEtsyListingUpdate("p1");
    expect(res).toMatchObject({ skipped: true, reason: "no_listing_id" });
  });
});

describe("runEtsyListingUpdate — happy path", () => {
  it("pushes the mapped payload, re-syncs media, upserts ES, bumps updatedAt, fires webhook", async () => {
    state.products = [baseProduct(), baseProduct()];
    const res = await runEtsyListingUpdate("p1");
    expect(res).toMatchObject({ skipped: false, listingId: 9999 });

    // listing field patch pushed (the mapped payload)
    expect(state.listingPatches).toHaveLength(1);
    expect(state.listingPatches[0]).toMatchObject({
      title: "Dress",
      quantity: 1,
    });

    // prior Etsy images deleted, current R2 set re-uploaded + reordered
    expect(state.deletedImageIds).toEqual([11, 12]);
    expect(state.uploadedImages).toHaveLength(2);
    expect(state.reorderImageIds).toEqual([1, 2]);

    // ES translation + updatedAt bump + coalescing webhook
    expect(state.translationUpserted).toBe("es");
    expect(state.updates.at(-1)).toHaveProperty("updatedAt");
    expect(state.webhookAdds).toHaveLength(1);
    expect(state.webhookAdds[0]).toMatchObject({
      name: "publish",
      opts: { jobId: "update:p1" },
    });
  });

  it("re-uploads the video when the product has one", async () => {
    state.products = [baseProduct(), baseProduct()];
    state.existingVideos = [{ video_id: 5 }];
    state.videos = [
      { r2Key: "products/2026/05/15/p1/video/clip.mp4", mimeType: "video/mp4" },
    ];
    await runEtsyListingUpdate("p1");
    expect(state.deletedVideoIds).toEqual([5]);
    expect(state.uploadedVideo).toBe("video.mp4");
  });

  it("accepts a scheduled product", async () => {
    state.products = [
      { ...baseProduct(), status: "scheduled" },
      { ...baseProduct(), status: "scheduled" },
    ];
    const res = await runEtsyListingUpdate("p1");
    expect(res).toMatchObject({ skipped: false });
  });
});

describe("runEtsyListingUpdate — featured-listing cap", () => {
  it("updates unfeatured (strips featured_rank) when 4 *other* listings are featured", async () => {
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
    const res = await runEtsyListingUpdate("p1");
    // Other fields/media still sync; the listing just stays unfeatured.
    expect(res).toMatchObject({ skipped: false, listingId: 9999 });
    expect(state.listingPatches[0]).not.toHaveProperty("featured_rank");
  });

  it("keeps featured_rank when this listing is itself one of the 4 featured (excluded from count)", async () => {
    state.products = [
      { ...baseProduct(), isFeatured: true },
      { ...baseProduct(), isFeatured: true },
    ];
    // 9999 is this listing; only 3 *others* hold slots.
    state.featuredListings = [
      { listing_id: 9999 },
      { listing_id: 1 },
      { listing_id: 2 },
      { listing_id: 3 },
    ];
    const res = await runEtsyListingUpdate("p1");
    expect(res).toMatchObject({ skipped: false, listingId: 9999 });
    expect(state.listingPatches[0]).toMatchObject({ featured_rank: 1 });
  });
});
