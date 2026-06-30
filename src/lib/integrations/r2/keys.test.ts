import { describe, expect, it } from "vitest";

import { isDev } from "@/lib/utils/config";

import {
  deriveTranscodedVideoKey,
  formatDatePrefix,
  generateImageKey,
  generateRawVideoKey,
  generateVideoKey,
  generateVideoPosterKey,
  productPrefix,
  publicUrlFor,
} from "./keys";

// 2026-05-15T12:00:00Z = May 15 14:00 in Europe/Madrid (CEST).
const CREATED_AT = new Date("2026-05-15T12:00:00Z");

// Generated keys carry the env prefix (`dev/` or `prod/`) so dev and
// prod objects stay isolated in the same R2 bucket. Mirror that logic
// here so the expectations track whichever env the suite runs under.
const PREFIX = isDev ? "dev" : "prod";

describe("formatDatePrefix", () => {
  it("renders YYYY/MM/DD in Europe/Madrid with zero-padded month + day", () => {
    expect(formatDatePrefix(CREATED_AT)).toBe("2026/05/15");
  });

  it("uses the Spanish-local calendar day, not UTC", () => {
    // 2026-05-15T22:30:00Z = May 16 00:30 in Europe/Madrid (DST).
    expect(formatDatePrefix(new Date("2026-05-15T22:30:00Z"))).toBe(
      "2026/05/16",
    );
  });

  it("zero-pads single-digit month + day", () => {
    // January 5.
    expect(formatDatePrefix(new Date("2026-01-05T12:00:00Z"))).toBe(
      "2026/01/05",
    );
  });
});

describe("generateImageKey", () => {
  it("builds the date-partitioned layout", () => {
    expect(
      generateImageKey({
        productId: "abc",
        createdAt: CREATED_AT,
        role: "original",
        uuid: "uuid-1",
        extension: "jpg",
      }),
    ).toBe(`${PREFIX}/products/2026/05/15/abc/original/uuid-1.jpg`);
  });

  it("strips a leading dot from extension and lowercases", () => {
    expect(
      generateImageKey({
        productId: "abc",
        createdAt: CREATED_AT,
        role: "original",
        uuid: "u",
        extension: ".JPG",
      }),
    ).toBe(`${PREFIX}/products/2026/05/15/abc/original/u.jpg`);
  });

  it.each(["webp", "jpg", "jpeg", "png", "avif"])(
    "accepts %s",
    (ext) => {
      expect(() =>
        generateImageKey({
          productId: "p",
          createdAt: CREATED_AT,
          role: "original",
          uuid: "u",
          extension: ext,
        }),
      ).not.toThrow();
    },
  );

  it("rejects unsupported extensions", () => {
    expect(() =>
      generateImageKey({
        productId: "p",
        createdAt: CREATED_AT,
        role: "original",
        uuid: "u",
        extension: "tiff",
      }),
    ).toThrow(/Unsupported image extension/);
  });

  it("uses the role in the path so prefix-deleting by role is possible", () => {
    expect(
      generateImageKey({
        productId: "p",
        createdAt: CREATED_AT,
        role: "ai_model",
        uuid: "u",
        extension: "jpg",
      }),
    ).toMatch(new RegExp(`^${PREFIX}/products/2026/05/15/p/ai_model/`));
  });
});

describe("generateVideoKey", () => {
  it("builds the date-partitioned layout", () => {
    expect(
      generateVideoKey({
        productId: "abc",
        createdAt: CREATED_AT,
        uuid: "uuid-1",
        extension: "mp4",
      }),
    ).toBe(`${PREFIX}/products/2026/05/15/abc/video/uuid-1.mp4`);
  });

  it.each(["mp4", "mov", "webm"])("accepts %s", (ext) => {
    expect(() =>
      generateVideoKey({
        productId: "p",
        createdAt: CREATED_AT,
        uuid: "u",
        extension: ext,
      }),
    ).not.toThrow();
  });

  it.each(["avi", "mkv", "flv", "webp", "jpg"])(
    "rejects %s as a video",
    (ext) => {
      expect(() =>
        generateVideoKey({
          productId: "p",
          createdAt: CREATED_AT,
          uuid: "u",
          extension: ext,
        }),
      ).toThrow(/Unsupported video extension/);
    },
  );
});

describe("generateRawVideoKey", () => {
  it("puts the raw source under its own video_raw bucket, keeping the source ext", () => {
    expect(
      generateRawVideoKey({
        productId: "abc",
        createdAt: CREATED_AT,
        uuid: "uuid-1",
        extension: "mov",
      }),
    ).toBe(`${PREFIX}/products/2026/05/15/abc/video_raw/uuid-1.mov`);
  });

  it.each(["avi", "mkv", "webp"])("rejects %s as a video", (ext) => {
    expect(() =>
      generateRawVideoKey({
        productId: "p",
        createdAt: CREATED_AT,
        uuid: "u",
        extension: ext,
      }),
    ).toThrow(/Unsupported video extension/);
  });
});

describe("deriveTranscodedVideoKey", () => {
  it("maps a raw key to the matching transcoded .mp4 key, preserving the stem", () => {
    const rawKey = generateRawVideoKey({
      productId: "abc",
      createdAt: CREATED_AT,
      uuid: "uuid-1",
      extension: "mov",
    });
    expect(deriveTranscodedVideoKey(rawKey)).toBe(
      generateVideoKey({
        productId: "abc",
        createdAt: CREATED_AT,
        uuid: "uuid-1",
        extension: "mp4",
      }),
    );
  });

  it("forces the .mp4 output extension regardless of source container", () => {
    expect(
      deriveTranscodedVideoKey(`${PREFIX}/products/2026/05/15/p/video_raw/u.webm`),
    ).toBe(`${PREFIX}/products/2026/05/15/p/video/u.mp4`);
  });

  it("throws when handed a non-raw key (guards against overwriting the wrong object)", () => {
    expect(() =>
      deriveTranscodedVideoKey(`${PREFIX}/products/2026/05/15/p/video/u.mp4`),
    ).toThrow(/Not a raw video key/);
  });
});

describe("generateVideoPosterKey", () => {
  it("always returns a .webp under the video_poster bucket of the dated prefix", () => {
    expect(
      generateVideoPosterKey({
        productId: "abc",
        createdAt: CREATED_AT,
        uuid: "uuid-1",
      }),
    ).toBe(`${PREFIX}/products/2026/05/15/abc/video_poster/uuid-1.webp`);
  });

  it("matches the same {productId}/{uuid} stem as the video so the pair correlates", () => {
    const videoKey = generateVideoKey({
      productId: "abc",
      createdAt: CREATED_AT,
      uuid: "uuid-1",
      extension: "mp4",
    });
    const posterKey = generateVideoPosterKey({
      productId: "abc",
      createdAt: CREATED_AT,
      uuid: "uuid-1",
    });
    expect(posterKey).toContain("uuid-1");
    expect(videoKey).toContain("uuid-1");
    expect(posterKey).toContain("abc");
    expect(videoKey).toContain("abc");
  });
});

describe("productPrefix", () => {
  it("ends with a slash (delete-prefix's safety check requires this)", () => {
    expect(productPrefix("abc", CREATED_AT)).toBe(
      `${PREFIX}/products/2026/05/15/abc/`,
    );
  });
});

describe("publicUrlFor", () => {
  it("joins base + key without doubling slashes", () => {
    expect(
      publicUrlFor(
        "products/2026/05/15/abc/original/u.jpg",
        "https://cdn.example",
      ),
    ).toBe("https://cdn.example/products/2026/05/15/abc/original/u.jpg");
  });

  it("tolerates a trailing slash on the base", () => {
    expect(
      publicUrlFor(
        "products/2026/05/15/abc/original/u.jpg",
        "https://cdn.example/",
      ),
    ).toBe("https://cdn.example/products/2026/05/15/abc/original/u.jpg");
  });

  it("tolerates a leading slash on the key", () => {
    expect(
      publicUrlFor(
        "/products/2026/05/15/abc/original/u.jpg",
        "https://cdn.example",
      ),
    ).toBe("https://cdn.example/products/2026/05/15/abc/original/u.jpg");
  });
});
