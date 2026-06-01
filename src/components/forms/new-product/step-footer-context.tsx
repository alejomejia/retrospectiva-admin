"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type FooterState = {
  canNext: boolean;
  disabledReason?: string;
  beforeNext?: () => Promise<boolean>;
};

type StepFooterContextValue = {
  state: FooterState;
  register: (s: FooterState) => void;
};

const StepFooterContext = createContext<StepFooterContextValue | null>(null);

export function StepFooterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FooterState>({ canNext: true });
  const register = useCallback((s: FooterState) => setState(s), []);
  return (
    <StepFooterContext.Provider value={{ state, register }}>
      {children}
    </StepFooterContext.Provider>
  );
}

export function useStepFooter() {
  const ctx = useContext(StepFooterContext);
  if (!ctx) throw new Error("useStepFooter must be inside StepFooterProvider");
  return ctx;
}
