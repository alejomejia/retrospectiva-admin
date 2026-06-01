// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type FetchCall = {
  path: string;
  init: RequestInit;
};

const fetchCalls: FetchCall[] = [];

let nextResponse: () => Response = () =>
  new Response(JSON.stringify({}), { status: 200 });

vi.mock("./client", () => ({
  etsyFetch: vi.fn(async (path: string, init: RequestInit = {}) => {
    fetchCalls.push({ path, init });
    return nextResponse();
  }),
}));

const {
  __testing,
  createDraftListing,
  updateListing,
  uploadListingImage,
  uploadListingVideo,
  upsertListingTranslation,
  getListing,
  etsyPriceToCents,
  getShopReceipts,
} = await import("./listings");

beforeEach(() => {
  fetchCalls.length = 0;
  nextResponse = () =>
    new Response(JSON.stringify({ listing_id: 1 }), { status: 200 });
});

describe("toFormUrlEncoded", () => {
  it("encodes arrays as a single comma-separated value", () => {
    const out = __testing.toFormUrlEncoded({ tags: ["a", "b", "c"] });
    expect(out).toBe("tags=a%2Cb%2Cc");
  });

  it("encodes booleans as 'true'/'false'", () => {
    const out = __testing.toFormUrlEncoded({ is_taxable: true, x: false });
    expect(out).toContain("is_taxable=true");
    expect(out).toContain("x=false");
  });

  it("drops null and undefined values", () => {
    const out = __testing.toFormUrlEncoded({ a: null, b: undefined, c: 1 });
    expect(out).toBe("c=1");
  });
});

describe("createDraftListing", () => {
  it("POSTs urlencoded body to shop listings endpoint", async () => {
    nextResponse = () =>
      new Response(JSON.stringify({ listing_id: 42, state: "draft" }), {
        status: 200,
      });
    const out = await createDraftListing(7, {
      quantity: 1,
      title: "T",
      description: "D",
      price: 12.34,
      who_made: "someone_else",
      when_made: "1990s",
      taxonomy_id: 99,
      tags: ["a", "b"],
    });
    expect(out.listing_id).toBe(42);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.path).toBe("/shops/7/listings");
    expect(fetchCalls[0]!.init.method).toBe("POST");
    expect(fetchCalls[0]!.init.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    expect(String(fetchCalls[0]!.init.body)).toContain("tags=a%2Cb");
  });

  it("throws on non-2xx with status + body in message", async () => {
    nextResponse = () =>
      new Response("invalid taxonomy", { status: 400 });
    await expect(
      createDraftListing(7, {
        quantity: 1,
        title: "T",
        description: "D",
        price: 1,
        who_made: "someone_else",
        when_made: "1990s",
        taxonomy_id: 99,
      }),
    ).rejects.toThrow(/400.*invalid taxonomy/);
  });
});

describe("etsyPriceToCents", () => {
  it("converts amount/divisor to integer cents", () => {
    expect(etsyPriceToCents({ amount: 1234, divisor: 100, currency_code: "USD" })).toBe(1234);
    expect(etsyPriceToCents({ amount: 4200, divisor: 100, currency_code: "USD" })).toBe(4200);
  });

  it("handles non-100 divisors", () => {
    // 12.5 with divisor 4 (amount 50) -> 1250 cents
    expect(etsyPriceToCents({ amount: 50, divisor: 4, currency_code: "USD" })).toBe(1250);
  });

  it("rounds to nearest cent", () => {
    // 9.999 -> 1000 cents
    expect(etsyPriceToCents({ amount: 9999, divisor: 1000, currency_code: "USD" })).toBe(1000);
  });
});

describe("getListing", () => {
  it("GETs the shop-scoped listing endpoint and returns price + state", async () => {
    nextResponse = () =>
      new Response(
        JSON.stringify({
          listing_id: 42,
          state: "active",
          quantity: 1,
          price: { amount: 4200, divisor: 100, currency_code: "USD" },
        }),
        { status: 200 },
      );
    const out = await getListing(7, 42);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.path).toBe("/shops/7/listings/42");
    expect(fetchCalls[0]!.init.method).toBe("GET");
    expect(out.listing_id).toBe(42);
    expect(out.state).toBe("active");
    expect(out.quantity).toBe(1);
    expect(out.price.amount).toBe(4200);
  });

  it("throws on non-2xx with status + body in message", async () => {
    nextResponse = () => new Response("not found", { status: 404 });
    await expect(getListing(7, 42)).rejects.toThrow(/404.*not found/);
  });
});

describe("getShopReceipts", () => {
  it("GETs paid receipts and returns results with transactions", async () => {
    nextResponse = () =>
      new Response(
        JSON.stringify({
          count: 1,
          results: [
            {
              receipt_id: 555,
              created_timestamp: 1_700_000_000,
              transactions: [{ transaction_id: 1, listing_id: 42 }],
            },
          ],
        }),
        { status: 200 },
      );
    const out = await getShopReceipts(7, { wasPaid: true, limit: 25 });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.path).toContain("/shops/7/receipts");
    expect(fetchCalls[0]!.path).toContain("was_paid=true");
    expect(fetchCalls[0]!.path).toContain("limit=25");
    expect(fetchCalls[0]!.init.method).toBe("GET");
    expect(out).toHaveLength(1);
    expect(out[0]!.transactions[0]!.listing_id).toBe(42);
  });

  it("passes min_created when provided", async () => {
    nextResponse = () =>
      new Response(JSON.stringify({ count: 0, results: [] }), { status: 200 });
    await getShopReceipts(7, { minCreated: 1_699_000_000 });
    expect(fetchCalls[0]!.path).toContain("min_created=1699000000");
  });

  it("throws on non-2xx with status + body in message", async () => {
    nextResponse = () => new Response("forbidden", { status: 403 });
    await expect(getShopReceipts(7, {})).rejects.toThrow(/403.*forbidden/);
  });
});

describe("updateListing", () => {
  it("PUTs urlencoded body", async () => {
    await updateListing(7, 42, { state: "active" });
    expect(fetchCalls[0]!.path).toBe("/shops/7/listings/42");
    expect(fetchCalls[0]!.init.method).toBe("PUT");
    expect(String(fetchCalls[0]!.init.body)).toContain("state=active");
  });
});

describe("uploadListingImage", () => {
  it("POSTs multipart with image part + rank + alt", async () => {
    nextResponse = () =>
      new Response(
        JSON.stringify({ listing_image_id: 7, rank: 1 }),
        { status: 200 },
      );
    await uploadListingImage(7, 42, {
      bytes: new Uint8Array([1, 2, 3]),
      filename: "x.jpg",
      contentType: "image/jpeg",
      rank: 1,
      altText: "alt",
    });
    expect(fetchCalls[0]!.path).toBe("/shops/7/listings/42/images");
    expect(fetchCalls[0]!.init.method).toBe("POST");
    expect(fetchCalls[0]!.init.body).toBeInstanceOf(FormData);
    const form = fetchCalls[0]!.init.body as FormData;
    expect(form.get("rank")).toBe("1");
    expect(form.get("alt_text")).toBe("alt");
    expect(form.get("image")).toBeInstanceOf(Blob);
    expect((form.get("image") as Blob).type).toBe("image/jpeg");
  });
});

describe("uploadListingVideo", () => {
  it("POSTs multipart with video part", async () => {
    await uploadListingVideo(7, 42, {
      bytes: new Uint8Array([1, 2, 3, 4]),
      filename: "v.mp4",
      contentType: "video/mp4",
      name: "showcase",
    });
    expect(fetchCalls[0]!.path).toBe("/shops/7/listings/42/videos");
    const form = fetchCalls[0]!.init.body as FormData;
    expect(form.get("name")).toBe("showcase");
    expect((form.get("video") as Blob).type).toBe("video/mp4");
  });
});

describe("upsertListingTranslation", () => {
  it("PUTs urlencoded body to /translations/{lang}", async () => {
    await upsertListingTranslation(7, 42, "es", {
      title: "T-es",
      description: "D-es",
      tags: ["a", "b"],
    });
    expect(fetchCalls[0]!.path).toBe(
      "/shops/7/listings/42/translations/es",
    );
    expect(fetchCalls[0]!.init.method).toBe("PUT");
    const body = String(fetchCalls[0]!.init.body);
    expect(body).toContain("title=T-es");
    expect(body).toContain("tags=a%2Cb");
  });
});
