import "server-only";
import { Buffer } from "node:buffer";
import { config } from "@/lib/utils/config";
import { devLog } from "@/lib/utils/dev";

export type AdminUser = {
  username: string;
  passwordHash: string;
};

/**
 * Bcrypt's canonical shape: `$2[abxy]$NN$<22-char salt><31-char digest>`,
 * 60 chars total. The alphabet is bcrypt's base64-ish set: `./0-9A-Za-z`.
 */
const BCRYPT_RE = /^\$2[abxy]\$\d{2}\$[./0-9A-Za-z]{53}$/;

/**
 * Decodes a base64 ALLOW_USERS hash value and verifies it has bcrypt's
 * canonical shape. We store the wrapped form in env on purpose so the
 * value can't be mangled by dotenv's `$VAR` interpolation. Standard
 * base64 (`A-Za-z0-9+/=`) contains no `$`, so the wrapping fully
 * sidesteps the problem.
 */
function decodeHash(encoded: string, username: string): string {
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    throw new Error(
      `ALLOW_USERS hash for "${username}" is not valid base64. ` +
        "Generate the env value with `pnpm hash-password` — its output is base64-encoded.",
    );
  }
  if (!BCRYPT_RE.test(decoded)) {
    throw new Error(
      `ALLOW_USERS hash for "${username}" did not decode to a bcrypt hash ` +
        `(expected /^\\$2[abxy]\\$NN\\$[./0-9A-Za-z]{53}$/, got ${decoded.length} chars). ` +
        "Re-run `pnpm hash-password` and paste the output verbatim into .env.local.",
    );
  }
  return decoded;
}

/**
 * Parses an ALLOW_USERS string of the shape
 *   `alice:<base64>,bob:<base64>`
 * into a `Map<username, AdminUser>`. The base64 value is the output of
 * `pnpm hash-password` and decodes to a bcrypt hash.
 *
 * Exposed as a pure function so unit tests don't have to round-trip
 * through `config`. Whitespace around entries is tolerated; empty
 * entries are skipped. Throws on malformed input — caller code (config
 * boot) makes this fire once at startup, not per request.
 */
export function parseAllowUsers(raw: string): Map<string, AdminUser> {
  const users = new Map<string, AdminUser>();
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx <= 0) {
      throw new Error(
        `Invalid ALLOW_USERS entry (expected "user:base64-hash"): ${entry}`,
      );
    }
    const username = trimmed.slice(0, colonIdx).trim();
    const encoded = trimmed.slice(colonIdx + 1).trim();
    if (!username || !encoded) {
      throw new Error(
        `Invalid ALLOW_USERS entry (empty user or hash): ${entry}`,
      );
    }
    if (users.has(username)) {
      throw new Error(`Duplicate ALLOW_USERS entry for "${username}"`);
    }
    const passwordHash = decodeHash(encoded, username);
    users.set(username, { username, passwordHash });
  }
  if (users.size === 0) {
    throw new Error("ALLOW_USERS must contain at least one user:hash pair.");
  }
  return users;
}

// Lazy + cached. Parsing happens on the first call so that a malformed
// ALLOW_USERS doesn't crash every module that imports this file at load
// time — the failure surfaces inside the caller (e.g. the signIn server
// action) which can render it as a toast instead of a runtime error
// page. The cache makes subsequent calls free, and a cached error
// prevents re-parsing a known-bad env on every request.
let cachedUsers: Map<string, AdminUser> | null = null;
let cachedError: Error | null = null;

function getUsers(): Map<string, AdminUser> {
  if (cachedError) throw cachedError;
  if (cachedUsers) return cachedUsers;
  try {
    cachedUsers = parseAllowUsers(config.allowUsers);
    devLog("ALLOW_USERS loaded:", [...cachedUsers.keys()]);
    return cachedUsers;
  } catch (err) {
    cachedError = err instanceof Error ? err : new Error(String(err));
    throw cachedError;
  }
}

export function findUser(username: string): AdminUser | undefined {
  return getUsers().get(username);
}

export function listUsernames(): string[] {
  return [...getUsers().keys()];
}
