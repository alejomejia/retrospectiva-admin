"use client";

import { type ReactNode } from "react";

import { AutosaveContext } from "./autosave.context";
import { useAutosaveProvider } from "./use-autosave-provider";

export { useAutosave } from "./autosave.context";
export type { AutosaveStatus, AutosaveContextValue } from "./autosave.types";

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
  const value = useAutosaveProvider({ productId, initialUpdatedAt });
  return (
    <AutosaveContext.Provider value={value}>
      {children}
    </AutosaveContext.Provider>
  );
}
