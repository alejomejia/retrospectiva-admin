/**
 * Lightweight tagged logging. Wraps `console` with a `[dev]` (or
 * `[dev:scope]`) tag.
 *
 * Visibility rule (deliberately asymmetric):
 *   - SERVER (`typeof window === "undefined"`): ALWAYS logs, in every
 *     environment including production. Server logs go to the container
 *     stdout, never to a user's browser, so there's no reason to hide
 *     them — and prod-only bugs (like silent upload failures) are
 *     un-debuggable without them.
 *   - CLIENT (browser bundle): logs only in development. In production
 *     these no-op so we never spam end-users' consoles or leak internals
 *     into the client.
 *
 * Safe to import from both client and server code. `typeof window` is
 * evaluated per-bundle, so the client bundle still collapses to `noop`
 * in prod.
 *
 * NOTE: this file is one of the few sanctioned exceptions to the
 * "no `process.env` outside `config.ts`" rule — see
 * `.agents/skills/project-conventions/consume-env-via-config.md`.
 */

// `process.env.NODE_ENV` is the one env value Next.js statically
// replaces in both server and client bundles, so this check resolves
// to a literal boolean at build time.
const IS_DEV = process.env.NODE_ENV === "development";
// On the server `window` is undefined; in the browser bundle it's defined.
const IS_SERVER = typeof window === "undefined";
// Server: always on. Client: dev-only.
const LOG_ENABLED = IS_SERVER || IS_DEV;

const noop: (...args: unknown[]) => void = () => {};

export const devLog: (...args: unknown[]) => void = LOG_ENABLED
  ? console.log.bind(console, "[dev]")
  : noop;

export const devWarn: (...args: unknown[]) => void = LOG_ENABLED
  ? console.warn.bind(console, "[dev]")
  : noop;

export const devError: (...args: unknown[]) => void = LOG_ENABLED
  ? console.error.bind(console, "[dev]")
  : noop;

export type DevLogger = {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

/**
 * Returns a logger scoped to a tag — handy for grouping output from
 * one subsystem so it's greppable as `[dev:auth]`, `[dev:queue]`, etc.
 * Each method is a no-op in production.
 *
 * @example
 *   const log = devGroup("auth");
 *   log.warn("user not found:", username);
 */
export function devGroup(tag: string): DevLogger {
  if (!LOG_ENABLED) return { log: noop, warn: noop, error: noop };
  const prefix = `[dev:${tag}]`;
  return {
    log: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}
