"use client";

import { useState } from "react";

import { m } from "@/lib/i18n/messages.en";
import { MONEY_STRING_RE, priceEurToCents } from "@/lib/utils/money";

/**
 * Local price-input state for the mark-sold dialog. Validates the typed
 * money string against the shared money regex and converts it to cents,
 * calling `onConfirm` only when the value is a positive amount. An empty
 * field fails the regex, so the price is effectively required.
 */
export function useMarkSoldDialog(
  onConfirm: (soldPriceCents: number) => void,
) {
  const [priceStr, setPriceStr] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPriceStr("");
    setError(null);
  };

  const submit = () => {
    const trimmed = priceStr.trim();
    if (!MONEY_STRING_RE.test(trimmed)) {
      setError(m.validation.priceFormat);
      return;
    }
    const cents = priceEurToCents(trimmed);
    if (cents <= 0) {
      setError(m.validation.priceGreaterThanZero);
      return;
    }
    setError(null);
    onConfirm(cents);
  };

  return { priceStr, setPriceStr, error, submit, reset };
}
