"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { updateProductDraftField } from "@/lib/products/draft-actions";
import { type ProductDraftPatch } from "@/lib/products/draft-schema";
import { devGroup } from "@/lib/utils/dev";

const dev = devGroup("autosave");
const DEBOUNCE_MS = 500;

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

type Ctx = {
  /** Merge `patch` into the pending changes and (re)debounce a save. */
  schedule: (patch: ProductDraftPatch) => void;
  /** Force-flush pending changes immediately. Resolves to `true` on success. */
  flush: () => Promise<boolean>;
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
};

const AutosaveContext = createContext<Ctx | null>(null);

/**
 * Tracks per-field changes from the stepper's inputs, coalesces
 * them across the 500 ms debounce window, and persists via
 * `updateProductDraftField`. Multiple field components share one
 * provider so rapid typing across fields fires a single batched
 * server action.
 */
export function AutosaveProvider({
  productId,
  initialUpdatedAt,
  children,
}: {
  productId: string;
  /** `updatedAt` from the row used to seed `lastSavedAt`. */
  initialUpdatedAt: Date;
  children: ReactNode;
}) {
  const pendingRef = useRef<ProductDraftPatch>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<boolean> | null>(null);

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    initialUpdatedAt,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const flush = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Coalesce: if a save is already running, queue behind it; the
    // pending patch will be sent once the in-flight call returns.
    if (inFlightRef.current) {
      await inFlightRef.current;
    }
    const patch = pendingRef.current;
    if (Object.keys(patch).length === 0) {
      setStatus("idle");
      return true;
    }
    pendingRef.current = {};
    setStatus("saving");
    const promise = (async () => {
      try {
        const result = await updateProductDraftField(productId, patch);
        if (result.ok) {
          setLastSavedAt(new Date(result.savedAt));
          setStatus("saved");
          setError(null);
          return true;
        }
        dev.error("autosave failed", result.error);
        setStatus("error");
        setError(result.error);
        // On failure, restore the patch so a future flush retries.
        pendingRef.current = { ...patch, ...pendingRef.current };
        return false;
      } catch (e) {
        dev.error("autosave threw", e);
        setStatus("error");
        setError(e instanceof Error ? e.message : "Unknown error");
        pendingRef.current = { ...patch, ...pendingRef.current };
        return false;
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = promise;
    return promise;
  }, [productId]);

  const schedule = useCallback(
    (patch: ProductDraftPatch) => {
      pendingRef.current = { ...pendingRef.current, ...patch };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void flush();
      }, DEBOUNCE_MS);
    },
    [flush],
  );

  const value = useMemo<Ctx>(
    () => ({ schedule, flush, status, lastSavedAt, error }),
    [schedule, flush, status, lastSavedAt, error],
  );

  return (
    <AutosaveContext.Provider value={value}>
      {children}
    </AutosaveContext.Provider>
  );
}

export function useAutosave(): Ctx {
  const ctx = useContext(AutosaveContext);
  if (!ctx) {
    throw new Error("useAutosave must be used inside AutosaveProvider");
  }
  return ctx;
}
