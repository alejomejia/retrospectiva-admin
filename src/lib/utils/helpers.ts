import { type ClassValue, clsx } from 'clsx'
import type { CSSProperties } from 'react'
import { twMerge } from 'tailwind-merge'

/**
 * Merges multiple class values into a single string of class names and removes duplicates.
 * @param inputs - The class values to merge
 * @returns The merged class names
 * @example
 * ```typescript
 * const className = cn('text-red-500', 'bg-blue-500', 'font-bold')
 * // Returns: 'text-red-500 bg-blue-500 font-bold'
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a plain object into a CSS custom-properties map.
 *
 * Number values are converted to the specified unit (`rem` by default, dividing by 16);
 * strings are passed through unchanged.
 *
 * @param vars - Key/value pairs where each key becomes `--key`.
 * @param unit - Unit applied to numeric values (default: `"rem"`).
 * @returns Object with `--`-prefixed keys, ready to spread into a `style` prop.
 *
 * @example
 * ```ts
 * toCSSVars({ gap: 16, color: 'red' })
 * // { '--gap': '1rem', '--color': 'red' }
 *
 * toCSSVars({ gap: 16 }, "px")
 * // { '--gap': '16px' }
 * ```
 */
export function toCSSVars(vars: Record<string, number | string>, unit: "px" | "rem" = "rem"): CSSProperties {
  return Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [
      `--${key}`,
      typeof value === "number" ? `${unit === "rem" ? value / 16 : value}${unit}` : value,
    ])
  )
}

/**
 * Reads an environment variable, returning the fallback when the var is unset or blank.
 *
 * Used by modules that want a string with an env-driven override —
 * AI prompt templates, feature flags, etc.
 *
 * @param key - The `process.env` key to read.
 * @param fallback - String returned when the env var is missing or only whitespace.
 * @returns The env value when present and non-blank; otherwise `fallback`.
 *
 * @example
 * ```ts
 * const SYSTEM_PROMPT = fromEnv("ENRICH_SYSTEM_PROMPT", DEFAULT_SYSTEM_PROMPT)
 * ```
 */
export function fromEnv(key: string, fallback: string): string {
  const v = process.env[key]
  return typeof v === "string" && v.trim() !== "" ? v : fallback
}