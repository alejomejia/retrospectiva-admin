"use client";

import { m } from "@/lib/i18n/messages.es";
import type { ClothingType } from "@/lib/db/schema";
import {
  doublesAtBoundary,
  getRequiredMeasurements,
} from "@/lib/products/clothing-types";
import type { ProductDraftPatch } from "@/lib/products/draft-schema";
import {
  measurementToColumn,
  type ProductMeasurements,
} from "@/lib/products/measurements";

import { useAutosave } from "../autosave";
import { BraSizeInput } from "./measurements-field-bra-size-input";
import { CmInput } from "./measurements-field-cm-input";
import { WaistInput } from "./measurements-field-waist-input";

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
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
        if (measurement === "waist") {
          const commit = (
            key: "waistCm" | "waistMaxCm",
            next: number | null,
          ) => {
            onChange({ ...values, [key]: next });
            schedule({ [key]: next } as ProductDraftPatch);
          };
          return (
            <WaistInput
              key="waist"
              doubles={doublesAtBoundary(clothingType, "waist")}
              min={values.waistCm}
              max={values.waistMaxCm}
              onChangeMin={(next) => commit("waistCm", next)}
              onChangeMax={(next) => commit("waistMaxCm", next)}
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
