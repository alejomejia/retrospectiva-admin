"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  saveReadinessState,
  saveReturnPolicy,
  saveShippingMapping,
} from "@/lib/integrations/etsy/defaults-actions";
import type {
  ReadinessStateDefinition,
  ReturnPolicy,
  ShippingProfile,
} from "@/lib/integrations/etsy/shop-config";
import { m } from "@/lib/i18n/messages.es";

type ShippingMappingFormProps = {
  shippingProfiles: ShippingProfile[];
  currentShippingProfileLightId: number | null;
  currentShippingProfileMediumId: number | null;
  currentShippingProfileHeavyId: number | null;
};

export function EtsyShippingMappingForm({
  shippingProfiles,
  currentShippingProfileLightId,
  currentShippingProfileMediumId,
  currentShippingProfileHeavyId,
}: ShippingMappingFormProps) {
  const [lightId, setLightId] = useState<string>(
    currentShippingProfileLightId?.toString() ?? "",
  );
  const [mediumId, setMediumId] = useState<string>(
    currentShippingProfileMediumId?.toString() ?? "",
  );
  const [heavyId, setHeavyId] = useState<string>(
    currentShippingProfileHeavyId?.toString() ?? "",
  );
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveShippingMapping({
        shippingProfileLightId: lightId,
        shippingProfileMediumId: mediumId,
        shippingProfileHeavyId: heavyId,
      });
      if (result.ok) {
        toast.success(m.settings.etsy.defaults.shippingMappingSaved);
      } else {
        toast.error(result.error);
      }
    });
  };

  if (shippingProfiles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {m.settings.etsy.defaults.shippingProfileEmpty}
      </p>
    );
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <ShippingSelect
        id="shipping-light"
        label={m.settings.etsy.defaults.shippingProfileLightLabel}
        value={lightId}
        onChange={setLightId}
        profiles={shippingProfiles}
      />
      <ShippingSelect
        id="shipping-medium"
        label={m.settings.etsy.defaults.shippingProfileMediumLabel}
        value={mediumId}
        onChange={setMediumId}
        profiles={shippingProfiles}
      />
      <ShippingSelect
        id="shipping-heavy"
        label={m.settings.etsy.defaults.shippingProfileHeavyLabel}
        value={heavyId}
        onChange={setHeavyId}
        profiles={shippingProfiles}
      />
      <Button type="submit" disabled={pending}>
        {pending
          ? m.settings.etsy.defaults.saving
          : m.settings.etsy.defaults.save}
      </Button>
    </form>
  );
}

function ShippingSelect({
  id,
  label,
  value,
  onChange,
  profiles,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  profiles: ShippingProfile[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue
            placeholder={m.settings.etsy.defaults.shippingProfilePlaceholder}
          />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((p) => (
            <SelectItem
              key={p.shipping_profile_id}
              value={p.shipping_profile_id.toString()}
            >
              {p.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type ReturnPolicyFormProps = {
  returnPolicies: ReturnPolicy[];
  currentReturnPolicyId: number | null;
};

export function EtsyReturnPolicyForm({
  returnPolicies,
  currentReturnPolicyId,
}: ReturnPolicyFormProps) {
  const [returnPolicyId, setReturnPolicyId] = useState<string>(
    currentReturnPolicyId?.toString() ?? "",
  );
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveReturnPolicy({ returnPolicyId });
      if (result.ok) {
        toast.success(m.settings.etsy.defaults.returnPolicySaved);
      } else {
        toast.error(result.error);
      }
    });
  };

  if (returnPolicies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {m.settings.etsy.defaults.returnPolicyEmpty}
      </p>
    );
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="return-policy">
          {m.settings.etsy.defaults.returnPolicyLabel}
        </Label>
        <Select value={returnPolicyId} onValueChange={setReturnPolicyId}>
          <SelectTrigger id="return-policy">
            <SelectValue
              placeholder={m.settings.etsy.defaults.returnPolicyPlaceholder}
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
      </div>

      <Button type="submit" disabled={pending}>
        {pending
          ? m.settings.etsy.defaults.saving
          : m.settings.etsy.defaults.save}
      </Button>
    </form>
  );
}

type ReadinessStateFormProps = {
  readinessStates: ReadinessStateDefinition[];
  currentReadinessStateId: number | null;
};

export function EtsyReadinessStateForm({
  readinessStates,
  currentReadinessStateId,
}: ReadinessStateFormProps) {
  const [readinessStateId, setReadinessStateId] = useState<string>(
    currentReadinessStateId?.toString() ?? "",
  );
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveReadinessState({ readinessStateId });
      if (result.ok) {
        toast.success(m.settings.etsy.defaults.readinessStateSaved);
      } else {
        toast.error(result.error);
      }
    });
  };

  if (readinessStates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {m.settings.etsy.defaults.readinessStateEmpty}
      </p>
    );
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="readiness-state">
          {m.settings.etsy.defaults.readinessStateLabel}
        </Label>
        <Select value={readinessStateId} onValueChange={setReadinessStateId}>
          <SelectTrigger id="readiness-state">
            <SelectValue
              placeholder={m.settings.etsy.defaults.readinessStatePlaceholder}
            />
          </SelectTrigger>
          <SelectContent>
            {readinessStates.map((r) => (
              <SelectItem
                key={r.readiness_state_id}
                value={r.readiness_state_id.toString()}
              >
                {readinessStateLabel(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={pending}>
        {pending
          ? m.settings.etsy.defaults.saving
          : m.settings.etsy.defaults.save}
      </Button>
    </form>
  );
}

function readinessStateLabel(r: ReadinessStateDefinition): string {
  if (r.processing_days_display_label) return r.processing_days_display_label;
  return m.settings.etsy.defaults.readinessStateOption(
    r.min_processing_days,
    r.max_processing_days,
    m.settings.etsy.defaults.readinessStateUnitBusinessDays,
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
