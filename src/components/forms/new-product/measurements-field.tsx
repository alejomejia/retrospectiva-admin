"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { m } from "@/lib/i18n/messages.es";
import type { ClothingType } from "@/lib/db/schema";
import {
  doublesAtBoundary,
  getRequiredMeasurements,
  type Measurement,
} from "@/lib/products/clothing-types";
import type { ProductDraftPatch } from "@/lib/products/draft-schema";
import { measurementToColumn, type ProductMeasurements } from "@/lib/products/measurements";

import { useAutosave } from "./autosave-context";

/**
 * Renders one numeric input per measurement required by the
 * selected clothing type. Doubled (chest/waist/hip/leg) measurements
 * show a live "Plano: X cm · Contorno: 2X cm" hint underneath the
 * value the user typed. Storage stays flat.
 *
 * Renders nothing when `clothingType` is null.
 */
export function MeasurementsField({
  clothingType,
  values,
  onChange,
}: {
  clothingType: ClothingType | null;
  values: ProductMeasurements;
  onChange: (next: ProductMeasurements) => void;
}) {
  const { schedule } = useAutosave();
  if (!clothingType) {
    return (
      <p className="text-sm text-muted-foreground">
        {m.products.form.measurementsHintPickType}
      </p>
    );
  }
  const required = getRequiredMeasurements(clothingType);
  if (required.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {m.products.form.measurementsNotRequired}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {required.map((measurement) => {
        if (measurement === "braSize") {
          return (
            <BraSizeInput
              key="braSize"
              value={values.braSize}
              onChange={(next) => {
                onChange({ ...values, braSize: next });
                schedule({ braSize: next });
              }}
            />
          );
        }
        return (
          <CmInput
            key={measurement}
            measurement={measurement}
            doubles={doublesAtBoundary(clothingType, measurement)}
            value={values[measurementToColumn(measurement) as keyof ProductMeasurements] as number | null}
            onChange={(next) => {
              const key = measurementToColumn(measurement);
              const nextValues = { ...values, [key]: next };
              onChange(nextValues as ProductMeasurements);
              schedule({ [key]: next } as ProductDraftPatch);
            }}
          />
        );
      })}
    </div>
  );
}

function CmInput({
  measurement,
  doubles,
  value,
  onChange,
}: {
  measurement: Exclude<Measurement, "braSize">;
  doubles: boolean;
  value: number | null;
  onChange: (next: number | null) => void;
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
    onChange(Math.round(n));
  };
  const id = `meas-${measurement}`;
  const label = m.products.form.measurements[measurement];
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-caplet" required>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          step={1}
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

function BraSizeInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [text, setText] = useState(value ?? "");
  return (
    <div className="space-y-1">
      <Label htmlFor="meas-bra-size" className="text-caplet" required>
        {m.products.form.measurements.braSize}
      </Label>
      <Input
        id="meas-bra-size"
        type="text"
        autoComplete="off"
        placeholder="90B"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(text.trim() === "" ? null : text.trim())}
      />
    </div>
  );
}
