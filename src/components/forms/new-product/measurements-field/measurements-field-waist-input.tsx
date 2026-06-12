"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { m } from "@/lib/i18n/messages.es";
import { isMeasurementRequired } from "@/lib/products/clothing-types";

import { CmInput } from "./measurements-field-cm-input";

/**
 * Waist input with optional max for resorted/elastic waistbands.
 *
 * Non-elastic (default): one "Cintura" field bound to the min column.
 * Toggling "Cintura resortada" reveals a second "Cintura máxima"
 * field; the first then reads "Cintura mínima". Turning the toggle
 * back off clears the max. Storage stays flat; both values double at
 * the boundary when the clothing type marks waist as x2.
 */
export function WaistInput({
  doubles,
  min,
  max,
  onChangeMin,
  onChangeMax,
}: {
  doubles: boolean;
  min: number | null;
  max: number | null;
  onChangeMin: (next: number | null) => void;
  onChangeMax: (next: number | null) => void;
}) {
  const [elastic, setElastic] = useState(max != null);

  const handleElasticChange = (next: boolean) => {
    setElastic(next);
    // Drop a previously-entered max when the waistband is no longer
    // marked elastic, so a stale value can't leak to the boundary.
    if (!next) onChangeMax(null);
  };

  return (
    <>
      <div className="space-y-2">
        <CmInput
          measurement="waist"
          doubles={doubles}
          value={min}
          onChange={onChangeMin}
          label={elastic ? m.products.form.waistMin : undefined}
          required={isMeasurementRequired("waist")}
        />
        <div className="flex items-center gap-2">
          <Switch
            id="waist-elastic"
            checked={elastic}
            onCheckedChange={handleElasticChange}
          />
          <Label htmlFor="waist-elastic" className="text-caplet">
            {m.products.form.waistElastic}
          </Label>
        </div>
      </div>
      {elastic && (
        <CmInput
          measurement="waist"
          idSuffix="max"
          doubles={doubles}
          value={max}
          onChange={onChangeMax}
          label={m.products.form.waistMax}
          required={false}
        />
      )}
    </>
  );
}
