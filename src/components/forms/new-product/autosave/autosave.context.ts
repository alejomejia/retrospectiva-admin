import { createContext, useContext } from "react";

import type { AutosaveContextValue } from "./autosave.types";

export const AutosaveContext = createContext<AutosaveContextValue | null>(null);

export function useAutosave(): AutosaveContextValue {
  const ctx = useContext(AutosaveContext);
  if (!ctx) {
    throw new Error("useAutosave must be used inside AutosaveProvider");
  }
  return ctx;
}
