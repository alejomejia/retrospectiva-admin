export type StepKey = "inputs" | "ai";

export const STEP_ORDER: StepKey[] = ["inputs", "ai"];

export function parseStep(raw: string | null): StepKey {
  if (raw && (STEP_ORDER as readonly string[]).includes(raw)) {
    return raw as StepKey;
  }
  return "inputs";
}
