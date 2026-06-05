import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/test/msw-server";

import {
  __etsyApiBase,
  EtsyNotConnectedError,
  etsyFetch,
  getValidAccessToken,
  type EtsyOAuthRow,
  type TokenStore,
} from "./client";
import { __endpoints, EtsyOAuthError } from "./oauth";

function makeRow(overrides: Partial<EtsyOAuthRow> = {}): EtsyOAuthRow {
  const now = new Date();
  return {
    id: "row-1",
    shopId: 123_456,
    accessToken: "at-current",
    refreshToken: "rt-current",
    scopes: "listings_w listings_r shops_r",
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    shippingProfileLightId: null,
    shippingProfileMediumId: null,
    shippingProfileHeavyId: null,
    defaultReturnPolicyId: null,
    defaultReadinessStateId: null,
    markupPercent: 30,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeStore(initial: EtsyOAuthRow | null): {
  store: TokenStore;
  state: { row: EtsyOAuthRow | null; updates: number };
} {
  const state = { row: initial, updates: 0 };
  const store: TokenStore = {
    read: async () => state.row,
    update: async (id, tokens) => {
      if (!state.row || state.row.id !== id) {
        throw new Error("row not found");
      }
      state.updates += 1;
      state.row = {
        ...state.row,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        updatedAt: new Date(),
      };
      return state.row;
    },
  };
  return { store, state };
}

describe("getValidAccessToken", () => {
  it("returns the stored token when it's not near expiry", async () => {
    const { store, state } = makeStore(makeRow());
    const result = await getValidAccessToken(store);
    expect(result.accessToken).toBe("at-current");
    expect(state.updates).toBe(0);
  });

  it("throws EtsyNotConnectedError when there's no row yet", async () => {
    const { store } = makeStore(null);
    await expect(getValidAccessToken(store)).rejects.toBeInstanceOf(
      EtsyNotConnectedError,
    );
  });

  it("refreshes + persists when the token is within the buffer window", async () => {
    const nearExpiry = new Date(Date.now() + 30 * 1000); // 30s — inside 60s buffer
    const { store, state } = makeStore(makeRow({ expiresAt: nearExpiry }));

    server.use(
      http.post(__endpoints.token, () =>
        HttpResponse.json({
          access_token: "at-rotated",
          refresh_token: "rt-rotated",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      ),
    );

    const result = await getValidAccessToken(store);
    expect(result.accessToken).toBe("at-rotated");
    expect(state.updates).toBe(1);
    expect(state.row?.refreshToken).toBe("rt-rotated");
  });

  it("surfaces EtsyOAuthError if Etsy rejects the refresh", async () => {
    const expired = new Date(Date.now() - 60_000);
    const { store } = makeStore(makeRow({ expiresAt: expired }));

    server.use(
      http.post(__endpoints.token, () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 401 }),
      ),
    );

    await expect(getValidAccessToken(store)).rejects.toBeInstanceOf(
      EtsyOAuthError,
    );
  });
});

describe("etsyFetch", () => {
  it("targets /v3/application/<path> and sends both required headers", async () => {
    const { store } = makeStore(makeRow());

    let capturedUrl = "";
    let capturedAuth: string | null = null;
    let capturedApiKey: string | null = null;

    server.use(
      http.get(`${__etsyApiBase}/users/me/shops`, ({ request }) => {
        capturedUrl = request.url;
        capturedAuth = request.headers.get("authorization");
        capturedApiKey = request.headers.get("x-api-key");
        return HttpResponse.json({
          results: [{ shop_id: 99, shop_name: "Retrospectiva" }],
        });
      }),
    );

    const res = await etsyFetch("/users/me/shops", {}, store);
    expect(res.ok).toBe(true);

    expect(capturedUrl).toBe(`${__etsyApiBase}/users/me/shops`);
    expect(capturedAuth).toBe("Bearer at-current");
    expect(capturedApiKey).toBe("test-etsy-client:test-etsy-secret");
  });

  it("normalizes a path missing the leading slash", async () => {
    const { store } = makeStore(makeRow());

    let capturedUrl = "";
    server.use(
      http.get(`${__etsyApiBase}/users/me/shops`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({});
      }),
    );

    await etsyFetch("users/me/shops", {}, store);
    expect(capturedUrl).toBe(`${__etsyApiBase}/users/me/shops`);
  });

  it("refreshes the token before the request when it's near expiry", async () => {
    const nearExpiry = new Date(Date.now() + 30 * 1000);
    const { store, state } = makeStore(makeRow({ expiresAt: nearExpiry }));

    server.use(
      http.post(__endpoints.token, () =>
        HttpResponse.json({
          access_token: "at-rotated",
          refresh_token: "rt-rotated",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      ),
      http.get(`${__etsyApiBase}/users/me/shops`, ({ request }) => {
        return HttpResponse.json({
          _auth: request.headers.get("authorization"),
        });
      }),
    );

    const res = await etsyFetch("/users/me/shops", {}, store);
    const body = (await res.json()) as { _auth: string };
    expect(body._auth).toBe("Bearer at-rotated");
    expect(state.updates).toBe(1);
  });

  it("returns the response even on non-2xx — callers handle errors", async () => {
    const { store } = makeStore(makeRow());

    server.use(
      http.get(`${__etsyApiBase}/users/me/shops`, () =>
        HttpResponse.json({ error: "Forbidden" }, { status: 403 }),
      ),
    );

    const res = await etsyFetch("/users/me/shops", {}, store);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });
});
