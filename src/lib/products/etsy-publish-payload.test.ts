// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  r2Key: string;
  role: "original" | "thumbnail";
  order: number;
  width: number | null;
  height: number | null;
};

const dbState: { rows: Row[] } = { rows: [] };

vi.mock("@/lib/db/client", () => ({
  db: {
    select: (_cols?: unknown) => ({
      from: (_table: unknown) => ({
        where: () => Promise.resolve(dbState.rows),
      }),
    }),
  },
}));

const {
  ETSY_LISTING_MAX_IMAGES,
  listImagesForEtsyPublish,
} = await import("./etsy-publish-payload");

function makeRow(over: Partial<Row> & { r2Key: string }): Row {
  return {
    role: "original",
    order: 0,
    width: 1200,
    height: 1200,
    ...over,
  };
}

beforeEach(() => {
  dbState.rows = [];
});

describe("listImagesForEtsyPublish", () => {
  it("returns originals in stored order", async () => {
    dbState.rows = [
      makeRow({ r2Key: "o2", role: "original", order: 1 }),
      makeRow({ r2Key: "o0", role: "original", order: 0 }),
      makeRow({ r2Key: "thumb1", role: "thumbnail", order: 0 }),
      makeRow({ r2Key: "o1", role: "original", order: 99 }),
    ];

    const out = await listImagesForEtsyPublish("p1");
    expect(out.map((i) => i.r2Key)).toEqual(["o0", "o2", "o1"]);
    expect(out.map((i) => i.role)).toEqual([
      "original",
      "original",
      "original",
    ]);
  });

  it("excludes thumbnail rows", async () => {
    dbState.rows = [
      makeRow({ r2Key: "o1", role: "original" }),
      makeRow({ r2Key: "thumb1", role: "thumbnail" }),
    ];

    const out = await listImagesForEtsyPublish("p1");
    expect(out.map((i) => i.r2Key)).toEqual(["o1"]);
  });

  it("returns [] when the product has no images at all", async () => {
    dbState.rows = [];
    expect(await listImagesForEtsyPublish("p1")).toEqual([]);
  });

  it("caps the set at ETSY_LISTING_MAX_IMAGES", async () => {
    dbState.rows = Array.from({ length: ETSY_LISTING_MAX_IMAGES + 3 }, (_, i) =>
      makeRow({ r2Key: `o${i}`, role: "original", order: i }),
    );

    const out = await listImagesForEtsyPublish("p1");
    expect(out).toHaveLength(ETSY_LISTING_MAX_IMAGES);
  });

  it("preserves width / height metadata for each entry", async () => {
    dbState.rows = [
      makeRow({
        r2Key: "o0",
        role: "original",
        width: 1800,
        height: 2400,
      }),
    ];
    const out = await listImagesForEtsyPublish("p1");
    expect(out[0]).toMatchObject({ width: 1800, height: 2400 });
  });
});
