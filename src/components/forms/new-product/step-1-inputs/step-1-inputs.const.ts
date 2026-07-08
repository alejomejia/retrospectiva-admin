import type {
  ClothingType,
  ProductCondition,
} from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.en";
import { STEP_1_REQUIRED } from "@/lib/products/draft-schema";

// Reference STEP_1_REQUIRED to ensure the keep-in-sync intent is
// obvious to a future reader.
void STEP_1_REQUIRED;

export function missingFieldList(s: {
  clothingType: ClothingType | null;
  condition: ProductCondition | null;
  basePriceCents: number | null;
  hasImage: boolean;
  measurementsFilled: boolean;
  shippingFilled: boolean;
}): string {
  const labels: string[] = [];
  if (!s.clothingType) labels.push(m.products.form.clothingType);
  if (!s.condition) labels.push(m.products.form.condition);
  if (s.basePriceCents === null || s.basePriceCents <= 0)
    labels.push(m.products.form.basePrice);
  if (!s.hasImage) labels.push(m.products.stepper.step1.imageRequired);
  if (s.clothingType && !s.measurementsFilled)
    labels.push(m.products.stepper.step1.measurementsRequired);
  if (!s.shippingFilled) labels.push(m.products.stepper.step1.shippingRequired);
  return labels.join(" · ");
}
