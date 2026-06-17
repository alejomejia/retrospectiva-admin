"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { m } from "@/lib/i18n/messages.es";
import { saveDefaultDiscount } from "@/lib/products/settings-actions";
import { DEFAULT_DISCOUNT_PERCENT } from "@/lib/products/pricing";

type Props = {
  currentDiscountPercent: number;
};

export function DefaultDiscountForm({ currentDiscountPercent }: Props) {
  const [discountPercent, setDiscountPercent] = useState<string>(
    String(currentDiscountPercent),
  );
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveDefaultDiscount({ defaultDiscountPercent: discountPercent });
      if (result.ok) {
        toast.success(m.settings.products.saved);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="discount-percent">
          {m.settings.products.discountLabel}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="discount-percent"
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            step={1}
            placeholder={String(DEFAULT_DISCOUNT_PERCENT)}
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {m.settings.products.discountHelp}
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? m.settings.products.saving : m.settings.products.save}
      </Button>
    </form>
  );
}
