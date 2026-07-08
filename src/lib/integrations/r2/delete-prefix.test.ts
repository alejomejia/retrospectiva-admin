import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { deleteR2Prefix } from "./delete-prefix";

type SendImpl = (cmd: ListObjectsV2Command | DeleteObjectsCommand) => unknown;

function mockClient(sendImpl: SendImpl) {
  const send = vi.fn(async (cmd) => sendImpl(cmd));
  return {
    client: { send } as unknown as S3Client,
    send,
  };
}

describe("deleteR2Prefix", () => {
  it("refuses prefixes that don't end with /", async () => {
    const { client } = mockClient(() => ({}));
    await expect(
      deleteR2Prefix({ prefix: "products/abc", client, bucket: "b" }),
    ).rejects.toThrow(/end with "\/"/);
  });

  it("returns 0 when the prefix is empty", async () => {
    const { client, send } = mockClient((cmd) => {
      if (cmd instanceof ListObjectsV2Command) {
        return { Contents: [], IsTruncated: false };
      }
      throw new Error("unexpected delete");
    });
    const r = await deleteR2Prefix({
      prefix: "products/abc/",
      client,
      bucket: "b",
    });
    expect(r.deletedCount).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("lists then deletes a single page", async () => {
    const { client, send } = mockClient((cmd) => {
      if (cmd instanceof ListObjectsV2Command) {
        return {
          Contents: [
            { Key: "products/abc/original/1.webp" },
            { Key: "products/abc/original/2.webp" },
            { Key: "products/abc/thumbnail/3.webp" },
          ],
          IsTruncated: false,
        };
      }
      if (cmd instanceof DeleteObjectsCommand) {
        return { Deleted: cmd.input.Delete?.Objects };
      }
      throw new Error("unknown");
    });

    const r = await deleteR2Prefix({
      prefix: "products/abc/",
      client,
      bucket: "b",
    });

    expect(r.deletedCount).toBe(3);
    // 1 list + 1 delete.
    expect(send).toHaveBeenCalledTimes(2);

    const deleteCmd = send.mock.calls[1]![0] as DeleteObjectsCommand;
    expect(deleteCmd.input.Delete?.Objects).toEqual([
      { Key: "products/abc/original/1.webp" },
      { Key: "products/abc/original/2.webp" },
      { Key: "products/abc/thumbnail/3.webp" },
    ]);
  });

  it("paginates via continuation tokens", async () => {
    const pages = [
      {
        Contents: [{ Key: "products/abc/a" }, { Key: "products/abc/b" }],
        IsTruncated: true,
        NextContinuationToken: "tok-1",
      },
      {
        Contents: [{ Key: "products/abc/c" }],
        IsTruncated: false,
      },
    ];
    let pageIdx = 0;

    const { client, send } = mockClient((cmd) => {
      if (cmd instanceof ListObjectsV2Command) {
        return pages[pageIdx++]!;
      }
      if (cmd instanceof DeleteObjectsCommand) {
        return { Deleted: cmd.input.Delete?.Objects };
      }
      throw new Error("unknown");
    });

    const r = await deleteR2Prefix({
      prefix: "products/abc/",
      client,
      bucket: "b",
    });

    expect(r.deletedCount).toBe(3);
    // 2 lists + 2 deletes (one per page).
    expect(send).toHaveBeenCalledTimes(4);
  });

  it("refuses to delete a returned key that escapes the prefix (defense in depth)", async () => {
    const { client } = mockClient((cmd) => {
      if (cmd instanceof ListObjectsV2Command) {
        return {
          Contents: [
            { Key: "products/abc/ok.webp" },
            // Simulate R2 returning a stray key — should never happen,
            // but if it does we MUST refuse.
            { Key: "products/abc-other/leak.webp" },
          ],
          IsTruncated: false,
        };
      }
      throw new Error("unexpected delete");
    });

    await expect(
      deleteR2Prefix({
        prefix: "products/abc/",
        client,
        bucket: "b",
      }),
    ).rejects.toThrow(/outside the requested prefix/);
  });
});
