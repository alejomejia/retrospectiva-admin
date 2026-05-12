// @vitest-environment node

// jsdom's polyfilled TextEncoder produces a Uint8Array from a different
// JS realm than the global one, which breaks jose's `payload instanceof
// Uint8Array` check inside FlattenedSign. Forcing node env here keeps
// jose happy without affecting the other tests.

import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

describe("session", () => {
  it("signs a JWT and verifies it back", async () => {
    const token = await signSession("alejandro");
    expect(token.split(".").length).toBe(3); // header.payload.signature
    const payload = await verifySession(token);
    expect(payload?.sub).toBe("alejandro");
  });

  it("rejects a tampered token", async () => {
    const token = await signSession("alejandro");
    const parts = token.split(".");
    // Flip the last character of the signature.
    parts[2] = parts[2]!.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    const tampered = parts.join(".");
    expect(await verifySession(tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const otherSecret = new TextEncoder().encode("a-completely-different-secret-string-here");
    const alien = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("imposter")
      .setIssuedAt()
      .setExpirationTime("1d")
      .sign(otherSecret);
    expect(await verifySession(alien)).toBeNull();
  });

  it("rejects an expired token", async () => {
    // Mint a token that expired one second ago.
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("alejandro")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 10)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
      .sign(secret);
    expect(await verifySession(expired)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifySession("not.a.jwt")).toBeNull();
    expect(await verifySession("")).toBeNull();
  });
});
