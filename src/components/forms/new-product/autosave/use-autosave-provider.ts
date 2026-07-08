"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { m } from "@/lib/i18n/messages.en";
import { updateProductDraftField } from "@/lib/products/draft-actions";
import { type ProductDraftPatch } from "@/lib/products/draft-schema";

import { DEBOUNCE_MS, dev } from "./autosave.const";
import type { AutosaveContextValue, AutosaveStatus } from "./autosave.types";

/**
 * Owns the debounced patch buffer + in-flight coalescing for the
 * autosave provider. Returns the context value the provider hands
 * down through `<AutosaveContext.Provider>`.
 */
export function useAutosaveProvider({
  productId,
  initialUpdatedAt,
}: {
  productId: string;
  initialUpdatedAt: Date;
}): AutosaveContextValue {
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
        // Surface the failure (incl. server-side zod validation, which
        // returns `m.errors.invalidForm`) as a toast — the corner pill
        // alone is easy to miss.
        toast.error(m.products.stepper.autosave.error, {
          description: result.error,
        });
        // On failure, restore the patch so a future flush retries.
        pendingRef.current = { ...patch, ...pendingRef.current };
        return false;
      } catch (e) {
        dev.error("autosave threw", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        setStatus("error");
        setError(message);
        toast.error(m.products.stepper.autosave.error, {
          description: message,
        });
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

  return useMemo<AutosaveContextValue>(
    () => ({ schedule, flush, status, lastSavedAt, error }),
    [schedule, flush, status, lastSavedAt, error],
  );
}
