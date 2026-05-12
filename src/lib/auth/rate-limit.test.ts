import { beforeEach, describe, expect, it } from "vitest";
import {
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_WINDOW_MS,
  __resetAllRateLimitBuckets,
  checkRate,
  resetRate,
} from "./rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    __resetAllRateLimitBuckets();
  });

  it("allows the first attempt", () => {
    expect(checkRate("key1")).toEqual({ allowed: true });
  });

  it("allows up to MAX_ATTEMPTS within the window", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      expect(checkRate("key1").allowed).toBe(true);
    }
    const blocked = checkRate("key1");
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
      expect(blocked.retryAfterSec).toBeLessThanOrEqual(
        Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
      );
    }
  });

  it("isolates buckets by key", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      checkRate("alice");
    }
    expect(checkRate("alice").allowed).toBe(false);
    expect(checkRate("bob").allowed).toBe(true);
  });

  it("resets the window once it elapses (simulated via timestamp injection)", () => {
    const now = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      checkRate("alice", now);
    }
    expect(checkRate("alice", now).allowed).toBe(false);
    // Jump past the window — old bucket is replaced with a fresh one.
    expect(checkRate("alice", now + RATE_LIMIT_WINDOW_MS + 1).allowed).toBe(true);
  });

  it("resetRate clears the bucket immediately (used after a successful login)", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      checkRate("alice");
    }
    expect(checkRate("alice").allowed).toBe(false);
    resetRate("alice");
    expect(checkRate("alice").allowed).toBe(true);
  });
});
