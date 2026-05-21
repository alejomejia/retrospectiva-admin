"use client";

import { Eye, Image as ImageIcon } from "lucide-react";
import Image from "next/image";

import type { ImageListItem } from "@/components/products/image-list";
import type { VideoListItem } from "@/components/products/video-list";

import type { GeneratedAiImage } from "./ai-image-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import {
  getClothingTypeLabel,
  getRequiredMeasurements,
  type Measurement,
} from "@/lib/products/clothing-types";
import { type SizeValue } from "@/lib/products/draft-schema";
import {
  doubledMeasurements,
  measurementToColumn,
  type ProductMeasurements,
} from "@/lib/products/measurements";
import {
  DEFAULT_MARKUP_PERCENT,
  effectiveListCents,
  effectiveMarkupPercent,
} from "@/lib/products/pricing";
import { formatCents } from "@/lib/utils/money";

/**
 * Read-only "this is what Etsy will see" preview. Renders every
 * field the publish payload would carry, with placeholders for the
 * AI-generated bits until Task 6 fills them in. Edits happen on
 * earlier steps; this step has only "back" / "continue" buttons.
 */
export function Step3Summary({
  product,
  shopMarkupPercent,
  imageItems,
  videoItems,
  aiGeneratedImage,
  onPrev,
  onNext,
}: {
  product: Product;
  shopMarkupPercent: number;
  imageItems: ImageListItem[];
  videoItems: VideoListItem[];
  aiGeneratedImage: GeneratedAiImage;
  onPrev: () => void;
  onNext: () => void;
}) {
  const measurements: ProductMeasurements = {
    shoulderCm: product.shoulderCm,
    chestCm: product.chestCm,
    waistCm: product.waistCm,
    hipCm: product.hipCm,
    riseCm: product.riseCm,
    legCm: product.legCm,
    lengthCm: product.lengthCm,
    braSize: product.braSize,
  };
  const doubled = doubledMeasurements(product.clothingType, measurements);

  const listCents = effectiveListCents({
    basePriceCents: product.basePriceCents,
    markupPercentOverride: product.markupPercentOverride,
    listPriceCentsOverride: product.listPriceCentsOverride,
    shopMarkupPercent,
  });
  const markup = effectiveMarkupPercent({
    markupPercentOverride: product.markupPercentOverride,
    listPriceCentsOverride: product.listPriceCentsOverride,
    shopMarkupPercent,
  });

  const sizes = (product.sizes as SizeValue[] | null) ?? [];
  const tags = product.etsyTagsEs ?? [];
  const materials = product.etsyMaterialsEs ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="size-5 text-brand-terracotta" />
          {m.products.stepper.summary.title}
        </CardTitle>
        <CardDescription>
          {m.products.stepper.summary.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Media row */}
        <section className="space-y-3">
          <Header label={m.products.stepper.summary.photos} />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {imageItems.length > 0
                ? m.products.stepper.summary.photoCount(imageItems.length)
                : m.products.stepper.summary.noPhotos}
              {videoItems.length > 0 &&
                ` · ${m.products.stepper.summary.videoCount(videoItems.length)}`}
            </span>
          </div>
          {imageItems.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {imageItems.slice(0, 5).map((img) => (
                <div
                  key={img.id}
                  className="aspect-square overflow-hidden rounded-sm border border-border bg-muted"
                >
                  <Image
                    src={img.url}
                    alt=""
                    width={200}
                    height={200}
                    className="size-full object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
              <ImageIcon className="size-6" />
            </div>
          )}
        </section>

        {aiGeneratedImage && (
          <section className="space-y-3">
            <Header label={m.products.stepper.summary.aiImage} />
            <div className="overflow-hidden rounded-md border border-border bg-muted">
              <Image
                src={aiGeneratedImage.url}
                alt=""
                width={aiGeneratedImage.width ?? 400}
                height={aiGeneratedImage.height ?? 600}
                className="h-auto w-full max-w-xs"
                unoptimized
              />
            </div>
          </section>
        )}

        <Separator />

        {/* Title + description. ES-only — the EN versions are
            translated inline at the Etsy-publish boundary, not
            previewed here. */}
        <section className="space-y-4">
          <Field
            label={m.products.stepper.summary.titleField}
            value={product.titleEs}
          />
          <Field
            label={m.products.stepper.summary.descriptionField}
            value={product.descriptionEs}
            multiline
          />
        </section>

        <Separator />

        {/* Pricing */}
        <section className="space-y-2">
          <Header label={m.products.stepper.summary.pricing} />
          <dl className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-2">
            <Cell
              label={m.products.stepper.summary.priceListed}
              value={
                listCents !== null
                  ? formatCents(listCents, product.currency)
                  : m.products.stepper.summary.emptyValue
              }
              emphasized
            />
            <Cell
              label={m.products.stepper.summary.priceBase}
              value={
                product.basePriceCents !== null
                  ? formatCents(product.basePriceCents, product.currency)
                  : m.products.stepper.summary.emptyValue
              }
            />
            <Cell
              label={m.products.stepper.summary.priceBuy}
              value={
                product.buyPriceCents !== null
                  ? formatCents(product.buyPriceCents, product.currency)
                  : m.products.stepper.summary.emptyValue
              }
            />
            <Cell
              label={m.products.stepper.summary.priceEarnings}
              value={
                product.basePriceCents !== null &&
                product.buyPriceCents !== null
                  ? formatCents(
                      product.basePriceCents - product.buyPriceCents,
                      product.currency,
                    )
                  : m.products.stepper.summary.emptyValue
              }
              emphasized
            />
          </dl>
          <p className="text-xs text-muted-foreground">
            {m.products.stepper.summary.priceMarkup(
              markup ?? DEFAULT_MARKUP_PERCENT,
            )}
          </p>
        </section>

        <Separator />

        {/* Etsy metadata */}
        <section className="space-y-3">
          <Header label={m.products.stepper.summary.etsyDetails} />
          <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2">
            <Cell
              label={m.products.stepper.summary.clothingType}
              value={
                product.clothingType
                  ? getClothingTypeLabel(product.clothingType)
                  : m.products.stepper.summary.emptyValue
              }
            />
            <Cell
              label={m.products.stepper.summary.condition}
              value={
                product.condition
                  ? m.products.conditions[product.condition]
                  : m.products.stepper.summary.emptyValue
              }
            />
            <Cell
              label={m.products.stepper.summary.whenMade}
              value={
                product.etsyWhenMade ??
                m.products.stepper.summary.emptyAiField
              }
            />
          </dl>
        </section>

        {/* Sizes */}
        <section className="space-y-2">
          <Header label={m.products.stepper.summary.sizes} />
          {sizes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <Badge key={s} variant="outline">
                  {m.products.sizes[s]}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {m.products.stepper.summary.emptyValue}
            </p>
          )}
        </section>

        {/* Measurements (boundary view) */}
        <section className="space-y-2">
          <Header
            label={m.products.stepper.summary.measurementsBoundary}
          />
          <MeasurementsTable
            clothingType={product.clothingType}
            doubled={doubled}
          />
        </section>

        <Separator />

        {/* Tags + materials (ES). EN versions land at the publish
            boundary; the model translates each chip 1:1. */}
        <section className="space-y-3">
          <Chips label={m.products.stepper.summary.tags} items={tags} />
          <Chips
            label={m.products.stepper.summary.materials}
            items={materials}
          />
        </section>

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onPrev}>
            {m.products.stepper.prev}
          </Button>
          <Button type="button" onClick={onNext}>
            {m.products.stepper.next}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Header({ label }: { label: string }) {
  return <h3 className="text-caplet">{label}</h3>;
}

function Cell({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={emphasized ? "font-medium text-foreground" : "text-foreground"}
      >
        {value}
      </dd>
    </div>
  );
}

function Field({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string | null;
  multiline?: boolean;
}) {
  const empty = !value;
  return (
    <div className="space-y-1.5">
      <p className="text-caplet">{label}</p>
      <div
        className={
          empty
            ? "text-sm italic text-muted-foreground"
            : multiline
              ? "text-sm whitespace-pre-line text-foreground"
              : "text-base font-medium text-foreground"
        }
      >
        {value ?? m.products.stepper.summary.emptyAiField}
      </div>
    </div>
  );
}

function Chips({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="space-y-2">
      <Header label={label} />
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge key={item} variant="secondary" className="font-normal">
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          {m.products.stepper.summary.emptyAiField}
        </p>
      )}
    </div>
  );
}

function MeasurementsTable({
  clothingType,
  doubled,
}: {
  clothingType: Product["clothingType"];
  doubled: ProductMeasurements;
}) {
  if (!clothingType) {
    return (
      <p className="text-sm text-muted-foreground">
        {m.products.stepper.summary.noMeasurements}
      </p>
    );
  }
  const required = getRequiredMeasurements(clothingType);
  const rows: Array<{ key: Measurement; value: string }> = required
    .map((measurement) => {
      if (measurement === "braSize") {
        return { key: measurement, value: doubled.braSize ?? "" };
      }
      const col = measurementToColumn(measurement);
      const v = doubled[col];
      return {
        key: measurement,
        value:
          typeof v === "number"
            ? `${v} cm`
            : "",
      };
    })
    .filter((r) => r.value !== "");
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {m.products.stepper.summary.noMeasurements}
      </p>
    );
  }
  return (
    <dl className="grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-3">
      {rows.map((row) => (
        <Cell
          key={row.key}
          label={m.products.form.measurements[row.key]}
          value={row.value}
        />
      ))}
    </dl>
  );
}
