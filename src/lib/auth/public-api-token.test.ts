import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hasValidPublicApiToken } from "./public-api-token";

function reqWith(auth?: string): Request {
  return new Request("https://admin.example/api/public/products", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("hasValidPublicApiToken", () => {
  const ORIGINAL = process.env.PUBLIC_API_TOKEN;

  beforeEach(() => {
    process.env.PUBLIC_API_TOKEN = "s3cret-read-token-value";
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.PUBLIC_API_TOKEN;
    else process.env.PUBLIC_API_TOKEN = ORIGINAL;
  });

  it("accepts the correct bearer token", () => {
    expect(hasValidPublicApiToken(reqWith("Bearer s3cret-read-token-value"))).toBe(
      true,
    );
  });

  it("rejects a wrong token", () => {
    expect(hasValidPublicApiToken(reqWith("Bearer nope"))).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(hasValidPublicApiToken(reqWith())).toBe(false);
    expect(hasValidPublicApiToken(reqWith("s3cret-read-token-value"))).toBe(
      false,
    );
  });

  it("fails closed when the secret is unset", () => {
    delete process.env.PUBLIC_API_TOKEN;
    expect(hasValidPublicApiToken(reqWith("Bearer anything"))).toBe(false);
  });
});
