"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ChipInput } from "@/components/forms/chip-input";
import { useAutosave } from "@/components/forms/new-product/autosave";
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
import { Textarea } from "@/components/ui/textarea";
import type { Product } from "@/lib/db/schema";
import {
  ETSY_COLORS,
  ETSY_COLOR_LABELS_EN,
  type EtsyColor,
} from "@/lib/integrations/etsy/etsy-colors";
import { m } from "@/lib/i18n/messages.en";
import {
  ETSY_ERA_VALUES,
  type EtsyEra,
} from "@/lib/products/draft-schema";
import { regenerateProductFieldAction } from "@/lib/products/draft-actions";

type RegenerableField =
  | "titleEn"
  | "websiteTitleEn"
  | "descriptionEn"
  | "etsyTagsEn"
  | "etsyMaterialsEn"
  | "etsyWhenMade"
  | "etsyPrimaryColor"
  | "etsySecondaryColor";

const TITLE_DEBOUNCE = 500;

/**
 * "AI content" section — the AI-generated fields that the user can
 * tweak, all in English (the canonical `*_en` columns). The derived
 * `*_es` columns are filled by the Etsy-publish processor (inline
 * `runTranslation` calls) right before the listing is pushed; they're
 * never displayed here, because we trust the model's translation 1:1.
 *
 * Two flavors of regeneration coexist:
 *
 * 1. Full pass — the header "Regenerar" button (shown when
 *    `onRegenerate` is provided) re-runs the entire enrichment queue
 *    job, wiping every AI field. Owned by the parent (it knows about
 *    the queue + polling state machine).
 *
 * 2. Per-field — every input renders an inline regenerate button that
 *    calls `regenerateProductFieldAction` directly. The server action
 *    replays the cached enrich input, asks OpenAI for ONLY that
 *    field, persists the single column, and returns the new value.
 *    The other fields keep their state — no remount, no router
 *    refresh.
 */
export function AiContentSection({
  product,
  onRegenerate,
  regenerating = false,
}: {
  product: Product;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  return (
    <div className="space-y-6">
      {onRegenerate && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={regenerating}
            onClick={onRegenerate}
            className="gap-1.5"
          >
            {regenerating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {regenerating
              ? m.products.editForm.aiContent.regenerating
              : m.products.editForm.aiContent.regenerate}
          </Button>
        </div>
      )}
      <TextField
        productId={product.id}
        label={m.products.editForm.aiContent.websiteTitle_field}
        field="websiteTitleEn"
        initial={product.websiteTitleEn}
        maxLength={70}
        hint={m.products.editForm.aiContent.websiteTitleHint}
      />
      <TextField
        productId={product.id}
        label={m.products.editForm.aiContent.title_field}
        field="titleEn"
        initial={product.titleEn}
        maxLength={140}
      />
      <TextareaField
        productId={product.id}
        label={m.products.editForm.aiContent.description_field}
        field="descriptionEn"
        initial={product.descriptionEn}
      />
      <ChipField
        productId={product.id}
        label={m.products.editForm.aiContent.tags}
        field="etsyTagsEn"
        initial={product.etsyTagsEn ?? []}
        maxItems={13}
        maxItemLength={30}
        placeholder={m.products.editForm.aiContent.tagsPlaceholder}
      />
      <ChipField
        productId={product.id}
        label={m.products.editForm.aiContent.materials}
        field="etsyMaterialsEn"
        initial={product.etsyMaterialsEn ?? []}
        maxItems={13}
        maxItemLength={45}
        placeholder={m.products.editForm.aiContent.materialsPlaceholder}
        required={false}
      />
      <EraField
        productId={product.id}
        initial={product.etsyWhenMade as EtsyEra | null}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          productId={product.id}
          field="etsyPrimaryColor"
          label={m.products.form.primaryColor}
          initial={product.etsyPrimaryColor as EtsyColor | null}
          allowEmpty={false}
        />
        <ColorField
          productId={product.id}
          field="etsySecondaryColor"
          label={m.products.form.secondaryColor}
          initial={product.etsySecondaryColor as EtsyColor | null}
          allowEmpty
        />
      </div>
    </div>
  );
}

// ---------- Per-field regenerate button ----------

/**
 * Hook that wraps the per-field server action with a `useTransition`
 * + toast on failure. Returns `{ trigger, pending }` for the inline
 * button to wire up. On success, the caller is handed the new value
 * via the `onSuccess` callback so it can update its local state
 * without a parent re-render.
 */
function useFieldRegenerate<F extends RegenerableField>(
  productId: string,
  field: F,
  label: string,
  onSuccess: (value: unknown) => void,
) {
  const [pending, startTransition] = useTransition();
  const trigger = () => {
    startTransition(async () => {
      const result = await regenerateProductFieldAction(productId, field);
      if (!result.ok) {
        toast.error(
          m.products.editForm.aiContent.regenerateFieldFailed(label),
          { description: result.error },
        );
        return;
      }
      onSuccess(result.value);
    });
  };
  return { trigger, pending };
}

function RegenerateFieldButton({
  label,
  pending,
  disabled = false,
  onClick,
}: {
  label: string;
  pending: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const aria = m.products.editForm.aiContent.regenerateField(label);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending || disabled}
      onClick={onClick}
      aria-label={aria}
      title={aria}
      className="h-auto gap-1.5 px-2 py-1 text-xs"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Sparkles className="size-3.5" />
      )}
      {m.products.editForm.aiContent.regenerate}
    </Button>
  );
}

function FieldHeader({
  label,
  required = true,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-caplet" required={required}>
        {label}
      </Label>
      {children}
    </div>
  );
}

// ---------- Text input ----------

function TextField({
  productId,
  label,
  field,
  initial,
  maxLength,
  hint,
}: {
  productId: string;
  label: string;
  field: "titleEn" | "websiteTitleEn";
  initial: string | null;
  maxLength: number;
  hint?: string;
}) {
  const { schedule } = useAutosave();
  const [value, setValue] = useState(initial ?? "");
  const debounce = useDebounced(TITLE_DEBOUNCE);
  const { trigger, pending } = useFieldRegenerate(
    productId,
    field,
    label,
    (next) => setValue(typeof next === "string" ? next : ""),
  );

  return (
    <div className="space-y-2">
      <FieldHeader label={label}>
        <RegenerateFieldButton
          label={label}
          pending={pending}
          onClick={trigger}
        />
      </FieldHeader>
      <Input
        value={value}
        maxLength={maxLength}
        disabled={pending}
        onChange={(e) => {
          setValue(e.target.value);
          debounce(() => {
            schedule({
              [field]: e.target.value.trim() === "" ? null : e.target.value.trim(),
            });
          });
        }}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ---------- Textarea ----------

function TextareaField({
  productId,
  label,
  field,
  initial,
}: {
  productId: string;
  label: string;
  field: "descriptionEn";
  initial: string | null;
}) {
  const { schedule } = useAutosave();
  const [value, setValue] = useState(initial ?? "");
  const debounce = useDebounced(TITLE_DEBOUNCE);
  const { trigger, pending } = useFieldRegenerate(
    productId,
    field,
    label,
    (next) => setValue(typeof next === "string" ? next : ""),
  );

  return (
    <div className="space-y-2">
      <FieldHeader label={label}>
        <RegenerateFieldButton
          label={label}
          pending={pending}
          onClick={trigger}
        />
      </FieldHeader>
      <Textarea
        value={value}
        rows={5}
        maxLength={2000}
        disabled={pending}
        onChange={(e) => {
          setValue(e.target.value);
          debounce(() => {
            schedule({
              [field]: e.target.value.trim() === "" ? null : e.target.value.trim(),
            });
          });
        }}
      />
    </div>
  );
}

// ---------- Chip list ----------

function ChipField({
  productId,
  label,
  field,
  initial,
  maxItems,
  maxItemLength,
  placeholder,
  required = true,
}: {
  productId: string;
  label: string;
  field: "etsyTagsEn" | "etsyMaterialsEn";
  initial: string[];
  maxItems: number;
  maxItemLength: number;
  placeholder: string;
  required?: boolean;
}) {
  const { schedule } = useAutosave();
  const [value, setValue] = useState<string[]>(initial);
  const { trigger, pending } = useFieldRegenerate(
    productId,
    field,
    label,
    (next) => {
      if (Array.isArray(next)) setValue(next as string[]);
    },
  );

  return (
    <div className="space-y-2">
      <FieldHeader label={label} required={required}>
        <RegenerateFieldButton
          label={label}
          pending={pending}
          onClick={trigger}
        />
      </FieldHeader>
      <ChipInput
        value={value}
        onChange={(next) => {
          setValue(next);
          schedule({ [field]: next });
        }}
        maxItems={maxItems}
        maxItemLength={maxItemLength}
        placeholder={placeholder}
        variant="secondary"
        ariaLabel={label}
      />
      <p className="text-xs text-muted-foreground">
        {m.products.editForm.aiContent.chipHint(value.length, maxItems)}
      </p>
    </div>
  );
}

// ---------- Era select ----------

function EraField({
  productId,
  initial,
}: {
  productId: string;
  initial: EtsyEra | null;
}) {
  const { schedule } = useAutosave();
  const [value, setValue] = useState<EtsyEra | null>(initial);
  const label = m.products.editForm.aiContent.era;
  const { trigger, pending } = useFieldRegenerate(
    productId,
    "etsyWhenMade",
    label,
    (next) => {
      if (typeof next === "string") setValue(next as EtsyEra);
    },
  );
  return (
    <div className="space-y-2">
      <FieldHeader label={label}>
        <RegenerateFieldButton
          label={label}
          pending={pending}
          onClick={trigger}
        />
      </FieldHeader>
      <Select
        value={value ?? undefined}
        disabled={pending}
        onValueChange={(next) => {
          const v = next as EtsyEra;
          setValue(v);
          schedule({ etsyWhenMade: v });
        }}
      >
        <SelectTrigger id="etsy-era">
          <SelectValue
            placeholder={m.products.editForm.aiContent.eraPlaceholder}
          />
        </SelectTrigger>
        <SelectContent>
          {ETSY_ERA_VALUES.map((era) => (
            <SelectItem key={era} value={era}>
              {m.products.etsyEras[era]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------- Color select ----------

const COLOR_EMPTY_VALUE = "__none__";

function ColorField({
  productId,
  field,
  label,
  initial,
  allowEmpty,
}: {
  productId: string;
  field: "etsyPrimaryColor" | "etsySecondaryColor";
  label: string;
  initial: EtsyColor | null;
  allowEmpty: boolean;
}) {
  const { schedule } = useAutosave();
  const [value, setValue] = useState<EtsyColor | null>(initial);
  const { trigger, pending } = useFieldRegenerate(
    productId,
    field,
    label,
    (next) => {
      if (next === null || typeof next === "string") {
        setValue((next ?? null) as EtsyColor | null);
      }
    },
  );
  return (
    <div className="space-y-2">
      <FieldHeader label={label}>
        <RegenerateFieldButton
          label={label}
          pending={pending}
          onClick={trigger}
        />
      </FieldHeader>
      <Select
        value={value ?? (allowEmpty ? COLOR_EMPTY_VALUE : undefined)}
        disabled={pending}
        onValueChange={(next) => {
          const v =
            allowEmpty && next === COLOR_EMPTY_VALUE
              ? null
              : (next as EtsyColor);
          setValue(v);
          schedule({ [field]: v });
        }}
      >
        <SelectTrigger id={`field-${field}`}>
          <SelectValue
            placeholder={m.products.form.colorPlaceholder}
          />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && (
            <SelectItem value={COLOR_EMPTY_VALUE}>
              {m.products.form.colorEmpty}
            </SelectItem>
          )}
          {ETSY_COLORS.map((c) => (
            <SelectItem key={c} value={c}>
              {ETSY_COLOR_LABELS_EN[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------- shared ----------

/**
 * Minimal debouncer hook. Returns a function that schedules `fn` to
 * run after `wait` ms; later calls reset the timer.
 */
function useDebounced(wait: number) {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (fn: () => void) => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(fn, wait);
  };
}
