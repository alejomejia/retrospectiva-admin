/**
 * Lightweight dev-only logging. Wraps `console` with a `[dev]` (or
 * `[dev:scope]`) tag and no-ops in production.
 *
 * Safe to import from both client and server code: only reads
 * `process.env.NODE_ENV`, which Next.js inlines as a build-time
 * constant. The `noop` branches are dead-code-eliminated in
 * production bundles, so calls cost literally nothing in prod.
 *
 * NOTE: this file is one of the few sanctioned exceptions to the
 * "no `process.env` outside `config.ts`" rule — see
 * `.agents/skills/project-conventions/consume-env-via-config.md`.
 */

// `process.env.NODE_ENV` is the one env value Next.js statically
// replaces in both server and client bundles, so this check resolves
// to a literal boolean at build time.
const IS_DEV = process.env.NODE_ENV === "development";

const noop: (...args: unknown[]) => void = () => {};

export const devLog: (...args: unknown[]) => void = IS_DEV
  ? console.log.bind(console, "[dev]")
  : noop;

export const devWarn: (...args: unknown[]) => void = IS_DEV
  ? console.warn.bind(console, "[dev]")
  : noop;

export const devError: (...args: unknown[]) => void = IS_DEV
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
  if (!IS_DEV) return { log: noop, warn: noop, error: noop };
  const prefix = `[dev:${tag}]`;
  return {
    log: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}
