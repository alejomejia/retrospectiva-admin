"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveEtsyDefaults } from "@/lib/integrations/etsy/defaults-actions";
import type {
  ReturnPolicy,
  ShippingProfile,
} from "@/lib/integrations/etsy/shop-config";
import { m } from "@/lib/i18n/messages.es";
import { DEFAULT_MARKUP_PERCENT } from "@/lib/products/pricing";

type Props = {
  shippingProfiles: ShippingProfile[];
  returnPolicies: ReturnPolicy[];
  currentShippingProfileId: number | null;
  currentReturnPolicyId: number | null;
  currentMarkupPercent: number;
  /**
   * When `true`, the Etsy-dependent fields (shipping / returns)
   * couldn't be fetched — render only the markup section.
   */
  etsyDataUnavailable: boolean;
};

export function EtsyDefaultsForm({
  shippingProfiles,
  returnPolicies,
  currentShippingProfileId,
  currentReturnPolicyId,
  currentMarkupPercent,
  etsyDataUnavailable,
}: Props) {
  const [shippingProfileId, setShippingProfileId] = useState<string>(
    currentShippingProfileId?.toString() ?? "",
  );
  const [returnPolicyId, setReturnPolicyId] = useState<string>(
    currentReturnPolicyId?.toString() ?? "",
  );
  const [markupPercent, setMarkupPercent] = useState<string>(
    String(currentMarkupPercent),
  );
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveEtsyDefaults({
        shippingProfileId,
        returnPolicyId,
        markupPercent,
      });
      if (result.ok) {
        toast.success(m.settings.etsy.defaults.saved);
      } else {
        toast.error(result.error);
      }
    });
  };

  const noShipping = shippingProfiles.length === 0;
  const noReturns = returnPolicies.length === 0;

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="markup-percent">
          {m.settings.etsy.defaults.markupLabel}
        </Label>
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
          {m.settings.etsy.defaults.markupHelp(DEFAULT_MARKUP_PERCENT)}
        </p>
      </div>

      {!etsyDataUnavailable && (
        <>
          <div className="space-y-2">
            <Label htmlFor="shipping-profile">
              {m.settings.etsy.defaults.shippingProfileLabel}
            </Label>
            {noShipping ? (
              <p className="text-sm text-muted-foreground">
                {m.settings.etsy.defaults.shippingProfileEmpty}
              </p>
            ) : (
              <Select
                value={shippingProfileId}
                onValueChange={setShippingProfileId}
              >
                <SelectTrigger id="shipping-profile">
                  <SelectValue
                    placeholder={
                      m.settings.etsy.defaults.shippingProfilePlaceholder
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {shippingProfiles.map((p) => (
                    <SelectItem
                      key={p.shipping_profile_id}
                      value={p.shipping_profile_id.toString()}
                    >
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="return-policy">
              {m.settings.etsy.defaults.returnPolicyLabel}
            </Label>
            {noReturns ? (
              <p className="text-sm text-muted-foreground">
                {m.settings.etsy.defaults.returnPolicyEmpty}
              </p>
            ) : (
              <Select
                value={returnPolicyId}
                onValueChange={setReturnPolicyId}
              >
                <SelectTrigger id="return-policy">
                  <SelectValue
                    placeholder={
                      m.settings.etsy.defaults.returnPolicyPlaceholder
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {returnPolicies.map((p) => (
                    <SelectItem
                      key={p.return_policy_id}
                      value={p.return_policy_id.toString()}
                    >
                      {returnPolicyLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </>
      )}

      <Button type="submit" disabled={pending}>
        {pending
          ? m.settings.etsy.defaults.saving
          : m.settings.etsy.defaults.save}
      </Button>
    </form>
  );
}

function returnPolicyLabel(p: ReturnPolicy): string {
  if (!p.accepts_returns) {
    return m.settings.etsy.defaults.returnPolicyNoReturns;
  }
  if (p.return_deadline) {
    return m.settings.etsy.defaults.returnPolicyAccepts(p.return_deadline);
  }
  return `#${p.return_policy_id}`;
}
