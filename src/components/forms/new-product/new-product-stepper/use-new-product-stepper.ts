"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";

import { m } from "@/lib/i18n/messages.es";

import { STEP_ORDER, parseStep, type StepKey } from "./new-product-stepper.const";

export function useNewProductStepper({
  etsyPoliciesConfigured,
}: {
  etsyPoliciesConfigured: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentStep = parseStep(searchParams.get("step"));
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  const steps = useMemo(
    () => [
      { id: "inputs", label: m.products.stepper.steps.inputs },
      { id: "ai", label: m.products.stepper.steps.aiReview },
    ],
    [],
  );

  const go = useCallback(
    (step: StepKey) => {
      const params = new URLSearchParams(searchParams);
      if (step === "inputs") params.delete("step");
      else params.set("step", step);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: true });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (etsyPoliciesConfigured) return;
    const id = toast.warning(m.products.stepper.publish.policiesMissing, {
      duration: Infinity,
      action: {
        label: m.products.stepper.publish.policiesMissingLink,
        onClick: () => router.push("/settings/integrations"),
      },
    });
    return () => {
      toast.dismiss(id);
    };
  }, [etsyPoliciesConfigured, router]);

  const prevStep = currentIndex > 0 ? STEP_ORDER[currentIndex - 1] : null;
  const nextStep =
    currentIndex < STEP_ORDER.length - 1
      ? STEP_ORDER[currentIndex + 1]
      : null;
  const nextStepLabel = nextStep
    ? steps.find((s) => s.id === nextStep)?.label ?? null
    : null;

  return {
    currentStep,
    currentIndex,
    steps,
    go,
    prevStep,
    nextStep,
    nextStepLabel,
  };
}
