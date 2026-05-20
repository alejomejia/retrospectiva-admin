"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveShopAiImageEnabled } from "@/lib/products/settings-actions";
import { m } from "@/lib/i18n/messages.es";

type Props = {
  currentAiImageEnabled: boolean;
};

export function AiImageToggleForm({ currentAiImageEnabled }: Props) {
  const [enabled, setEnabled] = useState(currentAiImageEnabled);
  const [pending, startTransition] = useTransition();

  const onChange = (next: boolean) => {
    const previous = enabled;
    setEnabled(next);
    startTransition(async () => {
      const result = await saveShopAiImageEnabled({ aiImageEnabled: next });
      if (result.ok) {
        toast.success(m.settings.products.saved);
      } else {
        setEnabled(previous);
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Switch
          id="shop-ai-image-enabled"
          checked={enabled}
          disabled={pending}
          onCheckedChange={onChange}
        />
        <Label htmlFor="shop-ai-image-enabled">
          {m.settings.products.aiImage.toggleLabel}
        </Label>
      </div>
      <p className="text-sm text-muted-foreground">
        {enabled
          ? m.settings.products.aiImage.toggleHelpOn
          : m.settings.products.aiImage.toggleHelpOff}
      </p>
    </div>
  );
}
