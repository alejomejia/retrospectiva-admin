import { z } from "zod";

import { MONEY_STRING_RE } from "@/lib/utils/money";

/**
 * Shared schema for the create/edit product form. Reused by:
 * - the client form (react-hook-form via `zodResolver`)
 * - the server action (re-validates before DB insert)
 *
 * Single source of truth means a field added here automatically tightens
 * both surfaces — no drift between client and server validation.
 *
 * Phase 2 scope: name + price in EUR. The rest of the vintage-clothing
 * fields (era, condition, size, fabric, story, …) land in a later phase
 * — see TODO(richer-fields) in the form.
 */

/** Two-decimal positive money string, like `49` or `49.99`. */
const moneyString = z
  .string()
  .trim()
  .min(1, { message: "Price is required" })
  .regex(MONEY_STRING_RE, {
    message: "Use a number like 49 or 49.99",
  })
  .refine((s) => parseFloat(s) > 0, { message: "Must be greater than 0" });

export const ProductFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(200, { message: "Keep it under 200 characters" }),
  priceEur: moneyString,
});

export type ProductFormValues = z.infer<typeof ProductFormSchema>;
