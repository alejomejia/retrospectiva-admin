"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { m } from "@/lib/i18n/messages.es";
import { effectiveListCents, inflatedListCents } from "@/lib/products/pricing";
import {
  centsToPriceEur,
  formatCents,
  priceEurToCents,
  MONEY_STRING_RE,
} from "@/lib/utils/money";

import { useAutosave } from "./autosave";

/**
 * Base-price input with a live "Etsy: €XX,XX" hint computed from
 * the shop markup (or the per-product override). The markup
 * override is shown collapsibly under "Ajustar margen".
 */
export function PriceField({
  basePriceCents,
  markupPercentOverride,
  shopMarkupPercent,
  shopDefaultDiscountPercent,
  discountPercent,
  currency,
  onBaseChange,
  onMarkupChange,
  onDiscountChange,
}: {
  basePriceCents: number | null;
  markupPercentOverride: number | null;
  shopMarkupPercent: number;
  /** Shop-wide default sale % written when the discount toggle goes on. */
  shopDefaultDiscountPercent: number;
  discountPercent: number | null;
  currency: string;
  onBaseChange: (cents: number | null) => void;
  onMarkupChange: (markup: number | null) => void;
  onDiscountChange: (percent: number | null) => void;
}) {
  const { schedule } = useAutosave();

  const [baseStr, setBaseStr] = useState(
    basePriceCents == null ? "" : centsToPriceEur(basePriceCents),
  );
  const [markupStr, setMarkupStr] = useState(
    markupPercentOverride == null ? "" : String(markupPercentOverride),
  );
  const [discountStr, setDiscountStr] = useState(
    discountPercent == null ? "" : String(discountPercent),
  );
  const [baseError, setBaseError] = useState<string | null>(null);

  const commitBase = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onBaseChange(null);
      schedule({ basePriceCents: null });
      setBaseError(null);
      return;
    }
    if (!MONEY_STRING_RE.test(trimmed)) {
      setBaseError(m.validation.priceFormat);
      return;
    }
    const cents = priceEurToCents(trimmed);
    if (cents <= 0) {
      setBaseError(m.validation.priceGreaterThanZero);
      return;
    }
    setBaseError(null);
    onBaseChange(cents);
    schedule({ basePriceCents: cents });
  };

  const commitMarkup = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onMarkupChange(null);
      schedule({ markupPercentOverride: null });
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0 || n > 500) return;
    const rounded = Math.round(n);
    onMarkupChange(rounded);
    schedule({ markupPercentOverride: rounded });
  };

  const etsyCents = effectiveListCents({
    basePriceCents,
    markupPercentOverride,
    shopMarkupPercent,
  });
  const activeMarkup = markupPercentOverride ?? shopMarkupPercent;

  const discountOn = discountPercent != null && discountPercent > 0;
  const activeDiscount = discountPercent ?? shopDefaultDiscountPercent;
  // Inflated (published) price when the discount is on, plus the price
  // the buyer pays once the matching Etsy sale is applied on top.
  const inflatedCents =
    etsyCents !== null ? inflatedListCents(etsyCents, activeDiscount) : null;
  const buyerPaysCents =
    inflatedCents !== null
      ? Math.round(inflatedCents * (1 - activeDiscount / 100))
      : null;

  const handleDiscountToggle = (next: boolean) => {
    const value = next ? shopDefaultDiscountPercent : null;
    onDiscountChange(value);
    setDiscountStr(value == null ? "" : String(value));
    schedule({ discountPercent: value });
  };

  // Per-product discount override. Empty falls back to the shop default
  // (the discount stays on); out-of-range input is ignored. Mirrors the
  // markup override's blur-commit behavior.
  const commitDiscount = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onDiscountChange(shopDefaultDiscountPercent);
      setDiscountStr(String(shopDefaultDiscountPercent));
      schedule({ discountPercent: shopDefaultDiscountPercent });
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 1 || n > 99) return;
    const rounded = Math.round(n);
    onDiscountChange(rounded);
    schedule({ discountPercent: rounded });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="base-price" className="text-caplet" required>
        {m.products.form.basePrice}
      </Label>
      <div className="flex flex-wrap items-start gap-2">
        <div className="space-y-1">
          <Input
            id="base-price"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={m.products.form.pricePlaceholder}
            value={baseStr}
            onChange={(e) => setBaseStr(e.target.value)}
            onBlur={(e) => commitBase(e.target.value)}
            className="w-40"
            aria-invalid={baseError !== null}
          />
          {baseError && (
            <p className="text-xs text-brand-terracotta">{baseError}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            id="markup-override"
            type="number"
            inputMode="numeric"
            min={0}
            max={500}
            placeholder={String(shopMarkupPercent)}
            value={markupStr}
            onChange={(e) => setMarkupStr(e.target.value)}
            onBlur={(e) => commitMarkup(e.target.value)}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>
      <div className="flex-1 self-center text-sm text-muted-foreground">
        {etsyCents !== null ? (
          <span>
            {m.products.form.etsyHintPrefix}{" "}
            <span className="font-medium text-foreground">
              {formatCents(etsyCents, currency)}
            </span>{" "}
            <span className="text-xs">
              {m.products.form.etsyHintMarkup(activeMarkup)}
            </span>
          </span>
        ) : (
          <span className="text-xs">{m.products.form.etsyHintEmpty}</span>
        )}
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3">
        <div className="space-y-0.5">
          <Label htmlFor="discount-toggle">
            {m.products.form.discount(activeDiscount)}
          </Label>
          <p className="text-sm text-muted-foreground">
            {discountOn && inflatedCents !== null && buyerPaysCents !== null
              ? m.products.form.discountHintActive({
                  inflated: formatCents(inflatedCents, currency),
                  buyerPays: formatCents(buyerPaysCents, currency),
                })
              : m.products.form.discountHint}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {discountOn && (
            <div className="flex items-center gap-1">
              <Input
                id="discount-override"
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                placeholder={String(shopDefaultDiscountPercent)}
                value={discountStr}
                onChange={(e) => setDiscountStr(e.target.value)}
                onBlur={(e) => commitDiscount(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          )}
          <Switch
            id="discount-toggle"
            checked={discountOn}
            onCheckedChange={handleDiscountToggle}
          />
        </div>
      </div>
    </div>
  );
}
