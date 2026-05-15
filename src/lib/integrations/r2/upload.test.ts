import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { uploadToR2 } from "./upload";

function mockClient() {
  const send = vi.fn().mockResolvedValue({});
  return { send } as unknown as S3Client & { send: ReturnType<typeof vi.fn> };
}

describe("uploadToR2", () => {
  it("issues a PutObjectCommand with the expected params and returns the key", async () => {
    const client = mockClient();
    const body = Buffer.from("fake image bytes");

    const returned = await uploadToR2({
      key: "products/abc/original/u.jpg",
      body,
      contentType: "image/jpeg",
      client,
      bucket: "test-bucket",
    });

    expect(returned).toBe("products/abc/original/u.jpg");
    expect(client.send).toHaveBeenCalledTimes(1);

    const cmd = client.send.mock.calls[0]![0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "products/abc/original/u.jpg",
      Body: body,
      ContentType: "image/jpeg",
    });
  });

  it("sets a 1-year immutable Cache-Control by default", async () => {
    const client = mockClient();
    await uploadToR2({
      key: "products/abc/original/u.jpg",
      body: Buffer.from(""),
      contentType: "image/jpeg",
      client,
      bucket: "b",
    });

    const cmd = client.send.mock.calls[0]![0] as PutObjectCommand;
    // Safe because keys are UUID-based and never overwritten — bytes at
    // a given key are stable for life. Drops Class B reads ~99% once
    // Cloudflare's edge caches a hot object.
    expect(cmd.input.CacheControl).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  it("honors an explicit Cache-Control override", async () => {
    const client = mockClient();
    await uploadToR2({
      key: "products/abc/original/u.jpg",
      body: Buffer.from(""),
      contentType: "image/jpeg",
      cacheControl: "no-store",
      client,
      bucket: "b",
    });

    const cmd = client.send.mock.calls[0]![0] as PutObjectCommand;
    expect(cmd.input.CacheControl).toBe("no-store");
  });

  it("propagates errors from the S3 client", async () => {
    const send = vi.fn().mockRejectedValue(new Error("network down"));
    const client = { send } as unknown as S3Client;
    await expect(
      uploadToR2({
        key: "k",
        body: Buffer.from(""),
        contentType: "image/jpeg",
        client,
        bucket: "b",
      }),
    ).rejects.toThrow(/network down/);
  });
});
