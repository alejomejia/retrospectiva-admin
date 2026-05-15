// @vitest-environment node
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import {
  signOAuthState,
  verifyOAuthState,
} from "./oauth-state";

const sessionSecret = new TextEncoder().encode(
  "test-session-secret-padded-to-32-chars-yes",
);

describe("signOAuthState + verifyOAuthState", () => {
  it("round-trips state + codeVerifier", async () => {
    const token = await signOAuthState({
      state: "state-abc",
      codeVerifier: "verifier-xyz",
    });
    const payload = await verifyOAuthState(token);
    expect(payload).toEqual({
      state: "state-abc",
      codeVerifier: "verifier-xyz",
    });
  });

  it("returns null for a token signed with the wrong audience", async () => {
    // Mint a JWT with the same secret but a different `aud`. Verify
    // must reject because we lock the audience to `etsy-oauth`.
    const wrongAudienceToken = await new SignJWT({
      state: "x",
      codeVerifier: "y",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("not-etsy-oauth")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(sessionSecret);
    expect(await verifyOAuthState(wrongAudienceToken)).toBeNull();
  });

  it("returns null on tampered tokens", async () => {
    const token = await signOAuthState({
      state: "s",
      codeVerifier: "v",
    });
    // flip a character in the signature segment
    const parts = token.split(".");
    parts[2] =
      parts[2]!.slice(0, -2) + (parts[2]!.endsWith("a") ? "bb" : "aa");
    const tampered = parts.join(".");
    expect(await verifyOAuthState(tampered)).toBeNull();
  });

  it("returns null on garbage input", async () => {
    expect(await verifyOAuthState("not-a-jwt")).toBeNull();
    expect(await verifyOAuthState("")).toBeNull();
  });
});
