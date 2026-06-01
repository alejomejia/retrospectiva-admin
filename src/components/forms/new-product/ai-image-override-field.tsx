"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { m } from "@/lib/i18n/messages.es";

import { useAutosave } from "./autosave";

/**
 * Binary toggle for the per-product AI image generation override.
 * Initial state derives from the shop setting when the product hasn't
 * been touched yet (`value === null`); toggling stores an explicit
 * boolean so the choice survives future shop-setting changes.
 */
export function AiImageOverrideField({
  value,
  shopAiImageEnabled,
}: {
  value: boolean | null;
  shopAiImageEnabled: boolean;
}) {
  const { schedule } = useAutosave();
  const [enabled, setEnabled] = useState<boolean>(value ?? shopAiImageEnabled);
  const [touched, setTouched] = useState<boolean>(value !== null);

  const handleChange = (next: boolean) => {
    setEnabled(next);
    setTouched(true);
    schedule({ aiImageEnabled: next });
  };

  const overrides = touched && enabled !== shopAiImageEnabled;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Switch
          id="product-ai-image-enabled"
          checked={enabled}
          onCheckedChange={handleChange}
        />
        <Label htmlFor="product-ai-image-enabled">
          {enabled
            ? m.products.editForm.aiImage.enabled
            : m.products.editForm.aiImage.disabled}
        </Label>
      </div>
      <p className="text-sm text-muted-foreground">
        {overrides
          ? m.products.editForm.aiImage.overriding(shopAiImageEnabled)
          : m.products.editForm.aiImage.currentShop(shopAiImageEnabled)}
      </p>
    </div>
  );
}
