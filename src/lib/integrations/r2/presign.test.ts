import { describe, expect, it } from "vitest";

import { R2_BUCKET } from "./client";
import { presignPutUrl } from "./presign";

const KEY = "prod/products/2026/06/30/abc/video_raw/uuid-1.mov";

describe("presignPutUrl", () => {
  it("signs a PUT URL pointing at the path-style {bucket}/{key} object", async () => {
    const url = await presignPutUrl({ key: KEY, contentType: "video/quicktime" });
    const parsed = new URL(url);
    expect(parsed.protocol).toBe("https:");
    expect(parsed.pathname).toBe(`/${R2_BUCKET}/${KEY}`);
  });

  it("carries the SigV4 query params with the expected expiry", async () => {
    const url = await presignPutUrl({
      key: KEY,
      contentType: "video/quicktime",
      expiresInSeconds: 600,
    });
    const q = new URL(url).searchParams;
    expect(q.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(q.get("X-Amz-Expires")).toBe("600");
    expect(q.get("X-Amz-Credential")).toBeTruthy();
    expect(q.get("X-Amz-Date")).toMatch(/^\d{8}T\d{6}Z$/);
    expect(q.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signs content-type + host but NOT the unsigned-payload header", async () => {
    const url = await presignPutUrl({ key: KEY, contentType: "video/mp4" });
    const signedHeaders =
      new URL(url).searchParams.get("X-Amz-SignedHeaders") ?? "";
    expect(signedHeaders).toContain("host");
    expect(signedHeaders).toContain("content-type");
    // x-amz-content-sha256 is the payload-hash carrier, excluded from
    // SignedHeaders so the browser doesn't have to echo it back.
    expect(signedHeaders).not.toContain("x-amz-content-sha256");
  });

  it("produces a different signature when the key changes", async () => {
    const a = await presignPutUrl({ key: KEY, contentType: "video/mp4" });
    const b = await presignPutUrl({
      key: KEY.replace("uuid-1", "uuid-2"),
      contentType: "video/mp4",
    });
    const sigA = new URL(a).searchParams.get("X-Amz-Signature");
    const sigB = new URL(b).searchParams.get("X-Amz-Signature");
    expect(sigA).not.toBe(sigB);
  });
});
