/**
 * Vitest alias target for the `server-only` package. In real Next.js
 * server bundles, `server-only` resolves to an empty module (via the
 * `react-server` export condition). Outside that condition the package
 * throws to prevent accidental client bundling. Vitest doesn't set the
 * react-server condition, so we alias `server-only` to this file in
 * vitest.config.ts and the modules that import it load cleanly.
 */
export {};
