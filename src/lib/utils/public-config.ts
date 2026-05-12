import { z } from "zod";

/**
 * Client-safe configuration. Only `NEXT_PUBLIC_*` variables go here — they
 * are inlined into the client bundle by Next.js. Importing this file from
 * a client component is safe; importing `config.ts` is not.
 *
 * Empty for now: every value the admin currently needs is server-side.
 * When a client component needs a configured value (e.g. a CDN base URL
 * for `<Image src>`), add it to the schema below as
 * `NEXT_PUBLIC_FOO: z.string()…` and surface it in `publicConfig`.
 */

const Schema = z.object({
  // Add NEXT_PUBLIC_* variables here.
});

const parsed = Schema.parse({});

export const publicConfig = {
  ...parsed,
} as const;
