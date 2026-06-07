"use client";

import type { ReactNode } from "react";

import type { Product } from "@/lib/db/schema";

import { EnrichmentStatusContext } from "./enrichment-status.context";
import { useEnrichmentStatus } from "./use-enrichment-status";

/**
 * Provides the shared enrichment phase to the whole stepper. Polling
 * lives here (not inside step 2) so the publish sidebar can disable
 * Publish while enrichment runs regardless of the active step.
 */
export function EnrichmentStatusProvider({
  product,
  children,
}: {
  product: Product;
  children: ReactNode;
}) {
  const value = useEnrichmentStatus({ product });
  return (
    <EnrichmentStatusContext.Provider value={value}>
      {children}
    </EnrichmentStatusContext.Provider>
  );
}

export { useEnrichmentStatusContext } from "./enrichment-status.context";
export type { EnrichmentStatusValue } from "./enrichment-status.context";
