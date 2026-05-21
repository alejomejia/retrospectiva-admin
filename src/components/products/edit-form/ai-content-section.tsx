"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import { ChipInput } from "@/components/forms/chip-input";
import { useAutosave } from "@/components/forms/new-product/autosave-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import {
  ETSY_ERA_VALUES,
  type EtsyEra,
} from "@/lib/products/draft-schema";

const TITLE_DEBOUNCE = 500;

/**
 * "Contenido IA" section — the AI-generated fields that the user can
 * tweak, all in Spanish. The corresponding `*_en` columns are filled
 * by the Phase 4c Etsy-publish processor (inline `runTranslation`
 * calls) right before the listing is pushed; they're never displayed
 * here, because the shop owner doesn't read English and we trust the
 * model's translation 1:1.
 *
 * When `onRegenerate` is provided, a "Regenerar" button appears in
 * the header. Used by both step 2 of the stepper and the flat edit
 * form. The handler is the only context-specific bit — each consumer
 * knows how to plumb the new run through its own state machine.
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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>{m.products.editForm.aiContent.title}</CardTitle>
          <CardDescription>
            {m.products.editForm.aiContent.description}
          </CardDescription>
        </div>
        {onRegenerate && (
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
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <TextField
          label={m.products.editForm.aiContent.title_field}
          field="titleEs"
          initial={product.titleEs}
          maxLength={140}
        />
        <TextareaField
          label={m.products.editForm.aiContent.description_field}
          field="descriptionEs"
          initial={product.descriptionEs}
        />
        <ChipField
          label={m.products.editForm.aiContent.tags}
          field="etsyTagsEs"
          initial={product.etsyTagsEs ?? []}
          maxItems={13}
          maxItemLength={30}
          placeholder={m.products.editForm.aiContent.tagsPlaceholder}
        />
        <ChipField
          label={m.products.editForm.aiContent.materials}
          field="etsyMaterialsEs"
          initial={product.etsyMaterialsEs ?? []}
          maxItems={13}
          maxItemLength={45}
          placeholder={m.products.editForm.aiContent.materialsPlaceholder}
        />
        <EraField initial={product.etsyWhenMade as EtsyEra | null} />
      </CardContent>
    </Card>
  );
}

// ---------- Text input ----------

function TextField({
  label,
  field,
  initial,
  maxLength,
}: {
  label: string;
  field: "titleEs";
  initial: string | null;
  maxLength: number;
}) {
  const { schedule } = useAutosave();
  const [value, setValue] = useState(initial ?? "");
  const debounce = useDebounced(TITLE_DEBOUNCE);

  return (
    <div className="space-y-2">
      <Label className="text-caplet" required>{label}</Label>
      <Input
        value={value}
        maxLength={maxLength}
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

// ---------- Textarea ----------

function TextareaField({
  label,
  field,
  initial,
}: {
  label: string;
  field: "descriptionEs";
  initial: string | null;
}) {
  const { schedule } = useAutosave();
  const [value, setValue] = useState(initial ?? "");
  const debounce = useDebounced(TITLE_DEBOUNCE);

  return (
    <div className="space-y-2">
      <Label className="text-caplet" required>{label}</Label>
      <Textarea
        value={value}
        rows={5}
        maxLength={2000}
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
  label,
  field,
  initial,
  maxItems,
  maxItemLength,
  placeholder,
}: {
  label: string;
  field: "etsyTagsEs" | "etsyMaterialsEs";
  initial: string[];
  maxItems: number;
  maxItemLength: number;
  placeholder: string;
}) {
  const { schedule } = useAutosave();
  const [value, setValue] = useState<string[]>(initial);

  return (
    <div className="space-y-2">
      <Label className="text-caplet" required>{label}</Label>
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

function EraField({ initial }: { initial: EtsyEra | null }) {
  const { schedule } = useAutosave();
  const [value, setValue] = useState<EtsyEra | null>(initial);
  return (
    <div className="space-y-2">
      <Label htmlFor="etsy-era" className="text-caplet" required>
        {m.products.editForm.aiContent.era}
      </Label>
      <Select
        value={value ?? undefined}
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
