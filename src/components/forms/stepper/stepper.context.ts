import { createContext, useContext } from "react";

export type StepperContextValue = {
  /** Zero-based index of the active step. */
  currentStepIndex: number;
};

/**
 * Internal context that distributes the active step index to Stepper
 * sub-components without explicit prop threading.
 */
export const StepperContext = createContext<StepperContextValue | null>(null);

/**
 * Consume StepperContext. Throws a descriptive error if called outside of a
 * <Stepper> tree, surfacing misuse at development time.
 */
export function useStepperContext(): StepperContextValue {
  const ctx = useContext(StepperContext);
  if (!ctx) {
    throw new Error("Stepper sub-components must be rendered inside <Stepper>");
  }
  return ctx;
}
