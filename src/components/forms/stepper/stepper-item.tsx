"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils/helpers";

import { useStepperContext } from "./stepper.context";

type Props = {
  /** Zero-based index of this step within the list. */
  index: number;
  /** Short label shown next to the number/check. */
  label: string;
  /** True when this is the last item in the list — suppresses the trailing separator. */
  isLast?: boolean;
  className?: string;
};

export function StepperItem({ index, label, isLast, className }: Props) {
  const { currentStepIndex } = useStepperContext();
  const completed = index < currentStepIndex;
  const active = index === currentStepIndex;

  return (
    <li
      className={cn("flex items-center gap-2", className)}
      aria-current={active ? "step" : undefined}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full border text-sm font-medium transition-colors",
          {
            "border-primary bg-primary text-primary-foreground": completed,
            "border-primary bg-card text-primary": active,
            "border-border bg-muted text-muted-foreground": !completed && !active,
          },
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
        {label}
      </span>
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            "mx-1 h-px w-8",
            completed ? "bg-primary" : "bg-brand-rule",
          )}
        />
      )}
    </li>
  );
}
