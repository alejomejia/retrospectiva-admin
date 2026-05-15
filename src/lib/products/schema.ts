import { z } from "zod";

import { m } from "@/lib/i18n/messages.es";
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
  .min(1, { message: m.validation.priceRequired })
  .regex(MONEY_STRING_RE, { message: m.validation.priceFormat })
  .refine((s) => parseFloat(s) > 0, {
    message: m.validation.priceGreaterThanZero,
  });

export const ProductFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: m.validation.nameRequired })
    .max(200, { message: m.validation.nameTooLong }),
  priceEur: moneyString,
});

export type ProductFormValues = z.infer<typeof ProductFormSchema>;
