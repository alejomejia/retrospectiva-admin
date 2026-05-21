"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { m } from "@/lib/i18n/messages.es";
import { generateModel } from "@/lib/ai-models/actions";
import { NewModelSchema, type NewModelInput } from "@/lib/ai-models/schemas";
import {
  AGE_RANGE_DEFAULT,
  AGE_RANGE_VALUES,
  BODY_TYPE_DEFAULT,
  BODY_TYPE_VALUES,
  FACE_SHAPE_VALUES,
  HAIR_COLOR_VALUES,
  HAIR_SHAPE_VALUES,
  HAIR_TYPE_VALUES,
  HEIGHT_RANGE_DEFAULT,
  HEIGHT_RANGE_VALUES,
  IMAGE_QUALITY_DEFAULT,
  IMAGE_QUALITY_VALUES,
  SKIN_TONE_DEFAULT,
  SKIN_TONE_VALUES,
} from "@/lib/ai-models/variables";

/**
 * "Nuevo modelo" form. Defines model identity only — garment, pose,
 * and environment live in the new-product AI generation step, not
 * here.
 *
 * All identity fields are required selects (no free-form text). The
 * label for the model is assigned post-generation on the detail
 * page, not here.
 */
export function NewModelForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Partial<NewModelInput>>({
    ageRange: AGE_RANGE_DEFAULT,
    bodyType: BODY_TYPE_DEFAULT,
    heightRange: HEIGHT_RANGE_DEFAULT,
    skinTone: SKIN_TONE_DEFAULT,
    imageQuality: IMAGE_QUALITY_DEFAULT,
  });

  const set = <K extends keyof NewModelInput>(
    key: K,
    value: NewModelInput[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const ready = NewModelSchema.safeParse(form).success;

  const submit = () => {
    const parsed = NewModelSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(m.errors.invalidForm);
      return;
    }
    startTransition(async () => {
      const result = await generateModel(parsed.data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/models/${result.data.modelId}`);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{m.models.new.sections.base}</CardTitle>
          <CardDescription>{m.models.new.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <FormSelect
              id="ageRange"
              label={m.models.new.fields.ageRange}
              value={form.ageRange}
              options={AGE_RANGE_VALUES}
              optionLabel={(v) =>
                m.models.ageRanges[v as keyof typeof m.models.ageRanges] ?? v
              }
              onChange={(v) => set("ageRange", v as NewModelInput["ageRange"])}
            />
            <FormSelect
              id="bodyType"
              label={m.models.new.fields.bodyType}
              value={form.bodyType}
              options={BODY_TYPE_VALUES}
              optionLabel={(v) =>
                m.models.bodyTypes[v as keyof typeof m.models.bodyTypes] ?? v
              }
              onChange={(v) => set("bodyType", v as NewModelInput["bodyType"])}
            />
            <FormSelect
              id="heightRange"
              label={m.models.new.fields.heightRange}
              value={form.heightRange}
              options={HEIGHT_RANGE_VALUES}
              optionLabel={(v) =>
                m.models.heightRanges[
                  v as keyof typeof m.models.heightRanges
                ] ?? v
              }
              onChange={(v) =>
                set("heightRange", v as NewModelInput["heightRange"])
              }
            />
            <FormSelect
              id="skinTone"
              label={m.models.new.fields.skinTone}
              value={form.skinTone}
              options={SKIN_TONE_VALUES}
              optionLabel={(v) =>
                m.models.skinTones[v as keyof typeof m.models.skinTones] ?? v
              }
              onChange={(v) => set("skinTone", v as NewModelInput["skinTone"])}
            />
            <FormSelect
              id="faceShape"
              label={m.models.new.fields.faceShape}
              value={form.faceShape}
              options={FACE_SHAPE_VALUES}
              optionLabel={(v) =>
                m.models.faceShapes[v as keyof typeof m.models.faceShapes] ?? v
              }
              onChange={(v) =>
                set("faceShape", v as NewModelInput["faceShape"])
              }
            />
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <FormSelect
              id="hairColor"
              label={m.models.new.fields.hairColor}
              value={form.hairColor}
              options={HAIR_COLOR_VALUES}
              optionLabel={(v) =>
                m.models.hairColors[v as keyof typeof m.models.hairColors] ?? v
              }
              onChange={(v) =>
                set("hairColor", v as NewModelInput["hairColor"])
              }
            />
            <FormSelect
              id="hairShape"
              label={m.models.new.fields.hairShape}
              value={form.hairShape}
              options={HAIR_SHAPE_VALUES}
              optionLabel={(v) =>
                m.models.hairShapes[v as keyof typeof m.models.hairShapes] ?? v
              }
              onChange={(v) =>
                set("hairShape", v as NewModelInput["hairShape"])
              }
            />
            <FormSelect
              id="hairType"
              label={m.models.new.fields.hairType}
              value={form.hairType}
              options={HAIR_TYPE_VALUES}
              optionLabel={(v) =>
                m.models.hairTypes[v as keyof typeof m.models.hairTypes] ?? v
              }
              onChange={(v) => set("hairType", v as NewModelInput["hairType"])}
            />
          </div>
          <div className="mt-6 max-w-xs space-y-1">
            <FormSelect
              id="imageQuality"
              label={m.models.new.fields.imageQuality}
              value={form.imageQuality}
              options={IMAGE_QUALITY_VALUES}
              optionLabel={(v) =>
                m.models.new.imageQualities[
                  v as keyof typeof m.models.new.imageQualities
                ] ?? v
              }
              onChange={(v) =>
                set("imageQuality", v as NewModelInput["imageQuality"])
              }
            />
            <p className="text-sm text-muted-foreground">
              {m.models.new.imageQualityHelp}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          onClick={submit}
          disabled={!ready || pending}
          className="gap-1.5"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {pending ? m.models.new.submitting : m.models.new.submit}
        </Button>
      </div>
    </div>
  );
}

function FormSelect<T extends string>({
  id,
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: T | undefined;
  options: readonly T[];
  optionLabel: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-caplet" required>
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as T)}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={m.models.new.placeholderSelect} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {optionLabel(opt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
