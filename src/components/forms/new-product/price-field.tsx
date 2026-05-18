"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { m } from "@/lib/i18n/messages.es";
import {
  DEFAULT_MARKUP_PERCENT,
  effectiveListCents,
} from "@/lib/products/pricing";
import {
  centsToPriceEur,
  formatCents,
  priceEurToCents,
  MONEY_STRING_RE,
} from "@/lib/utils/money";

import { useAutosave } from "./autosave-context";

/**
 * Base-price input with a live "Etsy: €XX,XX" hint computed from
 * the shop markup (or the per-product override). The markup
 * override is shown collapsibly under "Ajustar margen".
 */
export function PriceField({
  basePriceCents,
  markupPercentOverride,
  shopMarkupPercent,
  currency,
  onBaseChange,
  onMarkupChange,
}: {
  basePriceCents: number | null;
  markupPercentOverride: number | null;
  shopMarkupPercent: number;
  currency: string;
  onBaseChange: (cents: number | null) => void;
  onMarkupChange: (markup: number | null) => void;
}) {
  const { schedule } = useAutosave();

  const [baseStr, setBaseStr] = useState(
    basePriceCents == null ? "" : centsToPriceEur(basePriceCents),
  );
  const [markupOpen, setMarkupOpen] = useState(
    markupPercentOverride !== null,
  );
  const [markupStr, setMarkupStr] = useState(
    markupPercentOverride == null ? "" : String(markupPercentOverride),
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

  return (
    <div className="space-y-2">
      <Label htmlFor="base-price" className="text-caplet">
        {m.products.form.basePrice}
      </Label>
      <div className="flex flex-wrap items-start gap-3">
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
      </div>

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMarkupOpen((o) => !o)}
          className="text-caplet text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3" />
          {markupOpen
            ? m.products.form.markupHide
            : m.products.form.markupShow(shopMarkupPercent)}
        </Button>
        {markupOpen && (
          <div className="mt-2 flex items-center gap-2">
            <Label htmlFor="markup-override" className="text-sm">
              {m.products.form.markupLabel}
            </Label>
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
            {markupPercentOverride !== null && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMarkupStr("");
                  commitMarkup("");
                }}
              >
                {m.products.form.markupReset(DEFAULT_MARKUP_PERCENT)}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
