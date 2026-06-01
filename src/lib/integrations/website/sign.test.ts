// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  REPLAY_WINDOW_SECONDS,
  SIGNATURE_HEADER,
  SIGNATURE_PREFIX,
  TIMESTAMP_HEADER,
  signWebhook,
  verifyWebhookSignature,
} from "./sign";

const SECRET = "test-secret-1234567890";

describe("signWebhook", () => {
  it("produces a sha256= prefixed hex signature + timestamp header", () => {
    const out = signWebhook("{}", SECRET, 1_700_000_000);
    expect(out[TIMESTAMP_HEADER]).toBe("1700000000");
    expect(out[SIGNATURE_HEADER].startsWith(SIGNATURE_PREFIX)).toBe(true);
    expect(out[SIGNATURE_HEADER].slice(SIGNATURE_PREFIX.length)).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  it("is deterministic for same body+secret+timestamp", () => {
    const a = signWebhook("hello", SECRET, 42);
    const b = signWebhook("hello", SECRET, 42);
    expect(a[SIGNATURE_HEADER]).toBe(b[SIGNATURE_HEADER]);
  });

  it("changes when body changes", () => {
    const a = signWebhook("a", SECRET, 42);
    const b = signWebhook("b", SECRET, 42);
    expect(a[SIGNATURE_HEADER]).not.toBe(b[SIGNATURE_HEADER]);
  });

  it("changes when timestamp changes (timestamp is bound into MAC)", () => {
    const a = signWebhook("body", SECRET, 1);
    const b = signWebhook("body", SECRET, 2);
    expect(a[SIGNATURE_HEADER]).not.toBe(b[SIGNATURE_HEADER]);
  });

  it("changes when secret changes", () => {
    const a = signWebhook("body", "secret-a", 42);
    const b = signWebhook("body", "secret-b", 42);
    expect(a[SIGNATURE_HEADER]).not.toBe(b[SIGNATURE_HEADER]);
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a signature it just produced", () => {
    const body = '{"x":1}';
    const headers = signWebhook(body, SECRET, 1_700_000_000);
    expect(
      verifyWebhookSignature(
        body,
        SECRET,
        headers[SIGNATURE_HEADER],
        headers[TIMESTAMP_HEADER],
        1_700_000_000,
      ),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    const headers = signWebhook("original", SECRET, 1_700_000_000);
    expect(
      verifyWebhookSignature(
        "tampered",
        SECRET,
        headers[SIGNATURE_HEADER],
        headers[TIMESTAMP_HEADER],
        1_700_000_000,
      ),
    ).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const headers = signWebhook("body", SECRET, 1_700_000_000);
    expect(
      verifyWebhookSignature(
        "body",
        "other-secret",
        headers[SIGNATURE_HEADER],
        headers[TIMESTAMP_HEADER],
        1_700_000_000,
      ),
    ).toBe(false);
  });

  it("rejects timestamp outside the replay window", () => {
    const headers = signWebhook("body", SECRET, 1_700_000_000);
    expect(
      verifyWebhookSignature(
        "body",
        SECRET,
        headers[SIGNATURE_HEADER],
        headers[TIMESTAMP_HEADER],
        1_700_000_000 + REPLAY_WINDOW_SECONDS + 1,
      ),
    ).toBe(false);
  });

  it("rejects when the prefix is missing", () => {
    expect(
      verifyWebhookSignature("body", SECRET, "deadbeef", "1700000000"),
    ).toBe(false);
  });

  it("rejects when headers are missing", () => {
    expect(verifyWebhookSignature("body", SECRET, undefined, "1700000000")).toBe(
      false,
    );
    expect(
      verifyWebhookSignature("body", SECRET, `${SIGNATURE_PREFIX}aa`, undefined),
    ).toBe(false);
  });
});
