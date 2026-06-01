import type { ProductDraftPatch } from "@/lib/products/draft-schema";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export type AutosaveContextValue = {
  /** Merge `patch` into the pending changes and (re)debounce a save. */
  schedule: (patch: ProductDraftPatch) => void;
  /** Force-flush pending changes immediately. Resolves to `true` on success. */
  flush: () => Promise<boolean>;
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
};
