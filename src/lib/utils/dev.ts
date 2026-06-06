/**
 * Lightweight tagged logging. Wraps `console` with a `[dev]` (or
 * `[dev:scope]`) tag.
 *
 * Visibility: ALWAYS logs — server AND client, every environment
 * including production. This is a 2-user internal admin, so there's no
 * concern about spamming end-user consoles or leaking internals, and
 * prod-only bugs (silent upload failures, etc.) are otherwise
 * un-debuggable. Server logs go to container stdout; client logs go to
 * the browser console.
 *
 * Safe to import from both client and server code.
 *
 * NOTE: this file is one of the few sanctioned exceptions to the
 * "no `process.env` outside `config.ts`" rule — see
 * `.agents/skills/project-conventions/consume-env-via-config.md`.
 */

// Always on, both bundles, all environments — see visibility note above.
const LOG_ENABLED = true;

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
