"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { m } from "@/lib/i18n/messages.es";
import { type Measurement } from "@/lib/products/clothing-types";

export function CmInput({
  measurement,
  doubles,
  value,
  onChange,
  label: labelOverride,
  idSuffix,
  required = true,
}: {
  measurement: Exclude<Measurement, "braSize">;
  doubles: boolean;
  value: number | null;
  onChange: (next: number | null) => void;
  /** Overrides the i18n label keyed off `measurement` (e.g. waist min/max). */
  label?: string;
  /** Disambiguates the input id when two share a `measurement` (waist). */
  idSuffix?: string;
  /** Whether to render the required marker. Defaults to true. */
  required?: boolean;
}) {
  // Local text buffer between keystrokes and the onBlur commit; the
  // parent never resets it externally, so no prop-sync effect is
  // needed.
  const [text, setText] = useState(value == null ? "" : String(value));
  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onChange(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0 || n > 500) return;
    // Keep at most one decimal; cm columns are `real`.
    onChange(Math.round(n * 10) / 10);
  };
  const id = `meas-${measurement}${idSuffix ? `-${idSuffix}` : ""}`;
  const label = labelOverride ?? m.products.form.measurements[measurement];
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-caplet" required={required}>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={1}
          max={500}
          step={0.5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          className="pr-9"
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
          cm
        </span>
      </div>
      {doubles && value !== null && (
        <p className="text-xs text-muted-foreground">
          {m.products.form.measurementsDoubledHint(value, value * 2)}
        </p>
      )}
    </div>
  );
}
