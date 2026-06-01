"use client";

import { useMemo, type ReactNode } from "react";

import { StepperContext } from "./stepper.context";
import { StepperItem } from "./stepper-item";
import { StepperList } from "./stepper-list";

/**
 * Visual stepper shell. The caller composes the indicator row with
 * `<Stepper.List>` + `<Stepper.Item>` and renders the active step
 * content as siblings below.
 *
 * shadcn/ui has no stepper primitive — this is the documented custom
 * component (DESIGN_SYSTEM.md §6). Step state lives in the caller
 * (URL or local state); this component only handles the visuals.
 *
 * @example
 * <Stepper currentStepIndex={1}>
 *   <Stepper.List>
 *     <Stepper.Item index={0} label="Inputs" />
 *     <Stepper.Item index={1} label="Review" />
 *     <Stepper.Item index={2} label="Publish" isLast />
 *   </Stepper.List>
 *   {active === "review" && <ReviewStep />}
 * </Stepper>
 */
function StepperRoot({
  currentStepIndex,
  className,
  children,
}: {
  /** Zero-based index of the active step. */
  currentStepIndex: number;
  className?: string;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ currentStepIndex }), [currentStepIndex]);
  return (
    <StepperContext.Provider value={value}>
      <div className={className}>{children}</div>
    </StepperContext.Provider>
  );
}

export const Stepper = Object.assign(StepperRoot, {
  List: StepperList,
  Item: StepperItem,
});
