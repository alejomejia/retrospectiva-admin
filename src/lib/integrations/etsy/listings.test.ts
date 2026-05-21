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
} = await import("./listings");

beforeEach(() => {
  fetchCalls.length = 0;
  nextResponse = () =>
    new Response(JSON.stringify({ listing_id: 1 }), { status: 200 });
});

describe("toFormUrlEncoded", () => {
  it("encodes arrays as repeated keys", () => {
    const out = __testing.toFormUrlEncoded({ tags: ["a", "b", "c"] });
    expect(out).toBe("tags=a&tags=b&tags=c");
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
    expect(String(fetchCalls[0]!.init.body)).toContain("tags=a&tags=b");
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
    expect(body).toContain("tags=a&tags=b");
  });
});
