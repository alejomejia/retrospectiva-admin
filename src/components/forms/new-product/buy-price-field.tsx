"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { m } from "@/lib/i18n/messages.es";
import {
  centsToPriceEur,
  formatCents,
  priceEurToCents,
  MONEY_STRING_RE,
} from "@/lib/utils/money";

import { useAutosave } from "./autosave-context";

/**
 * Per-product buy price (cost). Default value is snapshotted from
 * `/settings/products` when the clothing type is first set; the user
 * can override it here. Earnings = basePrice - buyPrice (shown inline
 * + on the step-3 summary).
 *
 * Display value follows the prop until the user starts typing — that
 * way a parent-side default snapshot (after picking a clothing type)
 * shows up in the input without an effect-driven sync.
 */
export function BuyPriceField({
  buyPriceCents,
  basePriceCents,
  currency,
  onChange,
}: {
  buyPriceCents: number | null;
  basePriceCents: number | null;
  currency: string;
  onChange: (cents: number | null) => void;
}) {
  const { schedule } = useAutosave();
  const [localRaw, setLocalRaw] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayValue =
    localRaw !== null
      ? localRaw
      : buyPriceCents == null
        ? ""
        : centsToPriceEur(buyPriceCents);

  const commit = (next: string) => {
    const trimmed = next.trim();
    if (trimmed === "") {
      setError(null);
      onChange(null);
      schedule({ buyPriceCents: null });
      setLocalRaw(null);
      return;
    }
    if (!MONEY_STRING_RE.test(trimmed)) {
      setError(m.validation.priceFormat);
      return;
    }
    const cents = priceEurToCents(trimmed);
    if (cents < 0) {
      setError(m.validation.priceGreaterThanZero);
      return;
    }
    setError(null);
    onChange(cents);
    schedule({ buyPriceCents: cents });
    setLocalRaw(null);
  };

  const earnings =
    basePriceCents != null && buyPriceCents != null
      ? basePriceCents - buyPriceCents
      : null;

  return (
    <div className="space-y-2">
      <Label htmlFor="buy-price" className="text-caplet">
        {m.products.form.buyPrice}
      </Label>
      <div className="flex flex-wrap items-start gap-3">
        <div className="space-y-1">
          <Input
            id="buy-price"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={displayValue}
            onChange={(e) => setLocalRaw(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            className="w-40"
            aria-invalid={error !== null}
          />
          {error && (
            <p className="text-xs text-brand-terracotta">{error}</p>
          )}
        </div>
        <div className="flex-1 self-center text-sm text-muted-foreground">
          {earnings !== null ? (
            <span>
              {m.products.form.earnings}:{" "}
              <span className="font-medium text-foreground">
                {formatCents(earnings, currency)}
              </span>
            </span>
          ) : (
            <span className="text-xs">
              {basePriceCents == null
                ? m.products.form.earningsNoBase
                : m.products.form.earningsNoBuyPrice}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {m.products.form.buyPriceHint}
      </p>
    </div>
  );
}
