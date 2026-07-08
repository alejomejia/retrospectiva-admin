"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveShopMarkup } from "@/lib/integrations/etsy/defaults-actions";
import { m } from "@/lib/i18n/messages.en";
import { DEFAULT_MARKUP_PERCENT } from "@/lib/products/pricing";

type Props = {
  currentMarkupPercent: number;
};

export function ShopMarkupForm({ currentMarkupPercent }: Props) {
  const [markupPercent, setMarkupPercent] = useState<string>(
    String(currentMarkupPercent),
  );
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveShopMarkup({ markupPercent });
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
        <Label htmlFor="markup-percent">{m.settings.products.markupLabel}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="markup-percent"
            type="number"
            inputMode="numeric"
            min={0}
            max={500}
            step={1}
            placeholder={String(DEFAULT_MARKUP_PERCENT)}
            value={markupPercent}
            onChange={(e) => setMarkupPercent(e.target.value)}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {m.settings.products.markupHelp(DEFAULT_MARKUP_PERCENT)}
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? m.settings.products.saving : m.settings.products.save}
      </Button>
    </form>
  );
}
