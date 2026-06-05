import { createHash } from "node:crypto";

import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/test/msw-server";

import {
  __endpoints,
  buildAuthorizeUrl,
  ETSY_SCOPES,
  EtsyOAuthError,
  exchangeCodeForToken,
  generatePkcePair,
  generateState,
  refreshAccessToken,
} from "./oauth";

describe("generateState", () => {
  it("returns a 43-char base64url string (32 bytes of entropy)", () => {
    const s = generateState();
    expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("returns a different value every call", () => {
    const set = new Set(Array.from({ length: 10 }, generateState));
    expect(set.size).toBe(10);
  });
});

describe("generatePkcePair", () => {
  it("returns a verifier in the unreserved set and a matching S256 challenge", () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const expected = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    expect(codeChallenge).toBe(expected);
  });

  it("never reuses the same verifier", () => {
    const verifiers = new Set(
      Array.from({ length: 10 }, () => generatePkcePair().codeVerifier),
    );
    expect(verifiers.size).toBe(10);
  });
});

describe("buildAuthorizeUrl", () => {
  it("targets etsy.com/oauth/connect with every required OAuth + PKCE param", () => {
    const url = new URL(
      buildAuthorizeUrl({ state: "state-x", codeChallenge: "challenge-y" }),
    );

    expect(url.origin + url.pathname).toBe(__endpoints.authorize);

    const p = url.searchParams;
    expect(p.get("response_type")).toBe("code");
    expect(p.get("client_id")).toBe("test-etsy-client"); // from vitest.config.ts env
    expect(p.get("redirect_uri")).toBe(
      "http://localhost:3000/api/etsy/oauth/callback",
    );
    expect(p.get("scope")).toBe(ETSY_SCOPES.join(" "));
    expect(p.get("state")).toBe("state-x");
    expect(p.get("code_challenge")).toBe("challenge-y");
    expect(p.get("code_challenge_method")).toBe("S256");
  });

  it("requests the scopes the admin needs", () => {
    expect([...ETSY_SCOPES]).toEqual([
      "listings_w",
      "listings_r",
      "shops_r",
    ]);
  });
});

describe("exchangeCodeForToken", () => {
  it("POSTs the PKCE verifier as form-encoded and returns the tokens", async () => {
    let capturedBody = "";
    let capturedContentType: string | null = null;

    server.use(
      http.post(__endpoints.token, async ({ request }) => {
        capturedBody = await request.text();
        capturedContentType = request.headers.get("content-type");
        return HttpResponse.json({
          access_token: "at-1",
          refresh_token: "rt-1",
          expires_in: 3600,
          token_type: "Bearer",
        });
      }),
    );

    const tokens = await exchangeCodeForToken({
      code: "the-code",
      codeVerifier: "the-verifier",
    });

    expect(capturedContentType).toBe("application/x-www-form-urlencoded");
    const params = new URLSearchParams(capturedBody);
    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("client_id")).toBe("test-etsy-client");
    expect(params.get("redirect_uri")).toBe(
      "http://localhost:3000/api/etsy/oauth/callback",
    );
    expect(params.get("code")).toBe("the-code");
    expect(params.get("code_verifier")).toBe("the-verifier");
    // NOTE: client_secret must NOT be sent on the PKCE token exchange.
    expect(params.get("client_secret")).toBeNull();

    expect(tokens).toEqual({
      access_token: "at-1",
      refresh_token: "rt-1",
      expires_in: 3600,
      token_type: "Bearer",
    });
  });

  it("throws EtsyOAuthError carrying status + body when Etsy rejects", async () => {
    server.use(
      http.post(__endpoints.token, () =>
        HttpResponse.json(
          { error: "invalid_grant", error_description: "code expired" },
          { status: 400 },
        ),
      ),
    );

    await expect(
      exchangeCodeForToken({ code: "bad", codeVerifier: "v" }),
    ).rejects.toMatchObject({
      name: "EtsyOAuthError",
      status: 400,
    });
  });
});

describe("refreshAccessToken", () => {
  it("POSTs the refresh_token grant and returns the rotated tokens", async () => {
    let capturedBody = "";
    server.use(
      http.post(__endpoints.token, async ({ request }) => {
        capturedBody = await request.text();
        return HttpResponse.json({
          access_token: "at-2",
          refresh_token: "rt-2-rotated",
          expires_in: 3600,
          token_type: "Bearer",
        });
      }),
    );

    const tokens = await refreshAccessToken("rt-1");

    const params = new URLSearchParams(capturedBody);
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("client_id")).toBe("test-etsy-client");
    expect(params.get("refresh_token")).toBe("rt-1");
    expect(params.get("client_secret")).toBeNull();

    expect(tokens.refresh_token).toBe("rt-2-rotated");
  });

  it("throws EtsyOAuthError when Etsy rejects the refresh", async () => {
    server.use(
      http.post(__endpoints.token, () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 401 }),
      ),
    );

    await expect(refreshAccessToken("rt-stale")).rejects.toBeInstanceOf(
      EtsyOAuthError,
    );
  });
});
