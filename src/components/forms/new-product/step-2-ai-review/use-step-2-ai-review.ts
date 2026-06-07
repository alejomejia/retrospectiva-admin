"use client";

import { useEffect } from "react";

import { useEnrichmentStatusContext } from "../enrichment-status";
import { useStepFooter } from "../step-footer-context";

export function useStep2AiReview() {
  const { phase, error, kick, kickPending } = useEnrichmentStatusContext();

  const { register } = useStepFooter();
  useEffect(() => {
    register({ canNext: phase !== "running" });
  }, [register, phase]);

  return { phase, error, kick, kickPending };
}
