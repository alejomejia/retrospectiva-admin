import { loadEnvConfig } from "@next/env";

/**
 * Side-effect-only module: loads `.env.local` (+ `.env.development`
 * + `.env`) into `process.env` with the same precedence Next.js
 * uses. The worker's entrypoint imports this FIRST so subsequent
 * imports (`./redis`, `@/lib/db/client`, etc.) see populated env.
 *
 * Why a separate module: ES module evaluation hoists all imports
 * to the top before any executable statement runs. Calling
 * `loadEnvConfig` *between* imports in `worker.ts` would still
 * happen after dependents had read `process.env` empty. Putting
 * it inside a module that's imported first guarantees order.
 */
loadEnvConfig(process.cwd());
