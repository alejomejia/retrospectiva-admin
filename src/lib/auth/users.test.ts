import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { parseAllowUsers } from "./users";

// A syntactically valid bcrypt hash + its base64 wrapping. We never run
// bcrypt.compare against it — the parser only checks shape.
const BCRYPT = "$2b$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPq";
const B64 = Buffer.from(BCRYPT, "utf8").toString("base64");
const BCRYPT_2 = "$2a$12$ABCDEFGHIJKLMNOPQRSTUV0123456789abcdefghijklmnopqrstu";
const B64_2 = Buffer.from(BCRYPT_2, "utf8").toString("base64");

describe("parseAllowUsers", () => {
  it("parses a single user and decodes the base64 hash", () => {
    const map = parseAllowUsers(`alice:${B64}`);
    expect(map.size).toBe(1);
    expect(map.get("alice")).toEqual({
      username: "alice",
      passwordHash: BCRYPT,
    });
  });

  it("parses multiple users separated by commas", () => {
    const map = parseAllowUsers(`alice:${B64},bob:${B64_2}`);
    expect(map.size).toBe(2);
    expect(map.get("bob")?.passwordHash).toBe(BCRYPT_2);
  });

  it("tolerates whitespace around entries", () => {
    const map = parseAllowUsers(`  alice:${B64} , bob:${B64_2}  `);
    expect(map.size).toBe(2);
    expect(map.get("alice")?.passwordHash).toBe(BCRYPT);
  });

  it("skips empty entries (trailing commas)", () => {
    const map = parseAllowUsers(`alice:${B64},,bob:${B64_2},`);
    expect(map.size).toBe(2);
  });

  it("treats only the FIRST colon as separator", () => {
    // base64 never contains `:` itself, but verify the parser still
    // does the right thing if it did.
    const map = parseAllowUsers(`alice:${B64}`);
    expect(map.get("alice")?.passwordHash).toBe(BCRYPT);
  });

  it("throws on entry missing colon", () => {
    expect(() => parseAllowUsers("alicewithoutcolon")).toThrow(
      /expected "user:base64-hash"/,
    );
  });

  it("throws on entry with empty username", () => {
    expect(() => parseAllowUsers(`:${B64}`)).toThrow(/expected "user:base64-hash"/);
  });

  it("throws on entry with empty hash", () => {
    expect(() => parseAllowUsers("alice:")).toThrow(/empty user or hash/);
  });

  it("throws on duplicate usernames", () => {
    expect(() => parseAllowUsers(`alice:${B64},alice:${B64_2}`)).toThrow(
      /Duplicate/,
    );
  });

  it("throws if the env yields zero users", () => {
    expect(() => parseAllowUsers("")).toThrow(/at least one/);
    expect(() => parseAllowUsers(",,")).toThrow(/at least one/);
  });

  it("throws when the decoded value isn't a bcrypt hash", () => {
    // "this is not a hash" base64-encoded — decodes fine but fails the regex.
    const garbage = Buffer.from("this is not a hash", "utf8").toString("base64");
    expect(() => parseAllowUsers(`alice:${garbage}`)).toThrow(
      /did not decode to a bcrypt hash/,
    );
  });

  it("throws when the hash was eaten by dotenv interpolation", () => {
    // What the parser would see if `$2b$12$...` was passed unquoted and
    // dotenv ate the `$VAR` runs — leftover partial string is what bcrypt
    // sees in production. The regex catches it at boot instead.
    const mangled = Buffer.from("/UJ1V3oQxpZyPJuw05eFe", "utf8").toString(
      "base64",
    );
    expect(() => parseAllowUsers(`alice:${mangled}`)).toThrow(
      /did not decode to a bcrypt hash/,
    );
  });
});
