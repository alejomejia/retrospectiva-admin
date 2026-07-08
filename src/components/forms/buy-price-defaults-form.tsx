"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClothingType } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.en";
import { saveAllBuyPriceDefaults } from "@/lib/products/buy-price-defaults";
import { CLOTHING_TYPES, getCategoryLabel } from "@/lib/products/clothing-types";
import type { GarmentCategory } from "@/lib/products/clothing-types";
import { centsToPriceEur } from "@/lib/utils/money";

type Props = {
  defaults: Record<ClothingType, number | null>;
};

const CATEGORIES: GarmentCategory[] = ["upper", "lower", "complete", "special"];

export function BuyPriceDefaultsForm({ defaults }: Props) {
  const initial: Record<ClothingType, string> = Object.fromEntries(
    CLOTHING_TYPES.map((t) => [
      t.value,
      defaults[t.value] == null ? "" : centsToPriceEur(defaults[t.value]!),
    ]),
  ) as Record<ClothingType, string>;

  const [values, setValues] = useState<Record<ClothingType, string>>(initial);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const entries = CLOTHING_TYPES.map((t) => ({
        clothingType: t.value,
        priceEur: values[t.value],
      }));
      const result = await saveAllBuyPriceDefaults({ entries });
      if (result.ok) {
        toast.success(m.settings.products.saved);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      {CATEGORIES.map((category) => {
        const items = CLOTHING_TYPES.filter((t) => t.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              {getCategoryLabel(category)}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((t) => (
                <div
                  key={t.value}
                  className="flex items-center gap-2 rounded-md border border-border bg-card/40 p-3"
                >
                  <Label
                    htmlFor={`buy-price-${t.value}`}
                    className="flex-1 text-sm"
                  >
                    {m.products.clothingTypes[t.value]}
                  </Label>
                  <Input
                    id={`buy-price-${t.value}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={m.settings.products.buyPrice.rowEmptyHint}
                    value={values[t.value]}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [t.value]: e.target.value,
                      }))
                    }
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">€</span>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <Button type="submit" disabled={pending}>
        {pending ? m.settings.products.saving : m.settings.products.save}
      </Button>
    </form>
  );
}
