"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.en";

import { useStepFooter } from "../step-footer-context";
import type { StepKey } from "./new-product-stepper.const";

export function StepperFooter({
  prevStep,
  nextStep,
  nextStepLabel,
  onPrev,
  onNext,
}: {
  prevStep: StepKey | null;
  nextStep: StepKey | null;
  nextStepLabel: string | null;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { state } = useStepFooter();
  const [navigating, setNavigating] = useState(false);

  const handleNext = async () => {
    if (state.beforeNext) {
      setNavigating(true);
      const ok = await state.beforeNext();
      setNavigating(false);
      if (!ok) return;
    }
    onNext();
  };

  return (
    <div className="sticky bottom-0 z-10 h-16 flex items-center justify-end gap-3 bg-card border-t border-border px-6">
      {!state.canNext && state.disabledReason && (
        <p className="text-sm text-muted-foreground">{state.disabledReason}</p>
      )}
      {prevStep && (
        <Button type="button" variant="outline" onClick={onPrev}>
          {m.products.stepper.prev}
        </Button>
      )}
      {nextStep && (
        <Button
          type="button"
          onClick={handleNext}
          disabled={!state.canNext || navigating}
        >
          {m.products.stepper.next} · {nextStepLabel}
          <ArrowRight className="ml-1 size-4" />
        </Button>
      )}
    </div>
  );
}
