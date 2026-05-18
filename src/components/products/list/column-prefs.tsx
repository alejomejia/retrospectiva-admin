"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  COLUMN_KEYS,
  DEFAULT_COLUMN_PREFS,
  type ColumnKey,
  type ColumnPref,
} from "./types";

const STORAGE_KEY = "products.columns";

/**
 * Module-level store for column preferences, synced to
 * `localStorage`. Exposed via a `useSyncExternalStore` hook so:
 *
 * - SSR + first client render see `DEFAULT_COLUMN_PREFS` (no
 *   hydration mismatch).
 * - Subsequent renders read the persisted value.
 * - All consumers in the tree stay in lockstep.
 */

let cache: ColumnPref[] | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): ColumnPref[] {
  if (typeof window === "undefined") return DEFAULT_COLUMN_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const valid = sanitize(parsed);
        if (valid) return valid;
      }
    }
  } catch {
    // Malformed JSON or no localStorage — fall through to defaults.
  }
  return DEFAULT_COLUMN_PREFS;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ColumnPref[] {
  if (!cache) cache = readFromStorage();
  return cache;
}

function getServerSnapshot(): ColumnPref[] {
  return DEFAULT_COLUMN_PREFS;
}

function setCache(next: ColumnPref[]) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Safari private mode etc. — preference becomes ephemeral.
    }
  }
  for (const l of listeners) l();
}

export function useColumnPrefs() {
  const prefs = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggle = useCallback(
    (key: ColumnKey) => {
      setCache(
        prefs.map((p) =>
          p.key === key ? { ...p, visible: !p.visible } : p,
        ),
      );
    },
    [prefs],
  );

  const reorder = useCallback(
    (nextOrder: ColumnKey[]) => {
      const byKey = new Map(prefs.map((p) => [p.key, p]));
      setCache(
        nextOrder.flatMap<ColumnPref>((k) => {
          const p = byKey.get(k);
          return p ? [p] : [];
        }),
      );
    },
    [prefs],
  );

  const reset = useCallback(() => {
    setCache(DEFAULT_COLUMN_PREFS);
  }, []);

  return { prefs, toggle, reorder, reset };
}

function sanitize(input: unknown[]): ColumnPref[] | null {
  if (input.length === 0) return null;
  const seen = new Set<ColumnKey>();
  const result: ColumnPref[] = [];
  for (const entry of input) {
    if (typeof entry !== "object" || entry === null) return null;
    const e = entry as { key?: unknown; visible?: unknown };
    if (
      typeof e.key !== "string" ||
      !COLUMN_KEYS.includes(e.key as ColumnKey) ||
      typeof e.visible !== "boolean" ||
      seen.has(e.key as ColumnKey)
    ) {
      return null;
    }
    seen.add(e.key as ColumnKey);
    result.push({ key: e.key as ColumnKey, visible: e.visible });
  }
  // Backfill any new columns added after the user last touched the
  // selector (e.g. a future column added to COLUMN_KEYS).
  for (const k of COLUMN_KEYS) {
    if (!seen.has(k)) result.push({ key: k, visible: true });
  }
  return result;
}
