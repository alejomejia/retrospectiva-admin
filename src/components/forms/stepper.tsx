"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/helpers";

/**
 * Visual stepper shell. Numbered indicators across the top; the
 * caller renders the active step content below.
 *
 * shadcn/ui has no stepper primitive — this is the documented
 * custom component (DESIGN_SYSTEM.md §6). Kept intentionally small:
 * just the indicator row + the surrounding layout, no step state
 * (the caller owns navigation via URL or local state).
 */

export type StepperStep = {
  /** Stable id for the step. */
  id: string;
  /** Short label shown under the number. */
  label: string;
};

export function Stepper({
  steps,
  currentStepIndex,
  className,
  children,
}: {
  steps: StepperStep[];
  /** Zero-based index of the active step. */
  currentStepIndex: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-8", className)}>
      <ol
        role="list"
        className="flex flex-wrap items-center gap-2"
      >
        {steps.map((step, index) => {
          const completed = index < currentStepIndex;
          const active = index === currentStepIndex;
          return (
            <li
              key={step.id}
              className="flex items-center gap-2"
              aria-current={active ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                  {
                    "border-primary bg-primary text-primary-foreground": completed,
                    "border-primary bg-card text-primary": active,
                    "border-border bg-muted text-muted-foreground": !completed && !active
                  }
                )}
                aria-hidden
              >
                {completed ? <Check className="size-4" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-sm",
                  active
                    ? "font-medium text-foreground"
                    : completed
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "mx-1 h-px w-8",
                    index < currentStepIndex
                      ? "bg-primary"
                      : "bg-brand-rule",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      <div>{children}</div>
    </div>
  );
}
