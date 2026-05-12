import bcrypt from "bcryptjs";

/**
 * Bcrypt cost factor. 12 ≈ ~250ms per hash on modern hardware — fast enough
 * for login UX, slow enough that an offline brute force against a leaked
 * ALLOW_USERS env is effectively impossible.
 *
 * No `import "server-only"` here on purpose: this module is also called by
 * `scripts/hash-password.ts` which runs in a plain Node context.
 */
const ROUNDS = 12;

/**
 * Hash a plaintext password with bcrypt. Used by the hash-password script
 * to populate ALLOW_USERS; not used at runtime.
 *
 * @example
 *   const hash = await hashPassword("hunter2");
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/**
 * Constant-time bcrypt comparison. Returns `false` for malformed hashes
 * rather than throwing — caller decides how to surface that.
 *
 * @example
 * const ok = await verifyPassword(formInput, storedHash);
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
