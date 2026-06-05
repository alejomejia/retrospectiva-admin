import { useState, useTransition } from "react";
import { toast } from "sonner";

import { m } from "@/lib/i18n/messages.es";
import { saveListingFooterOverride } from "@/lib/products/draft-actions";

/**
 * State + server-action wiring for the step-2 listing-footer override.
 * The override is ES-only on the way in; the action machine-translates
 * to EN and caches both columns, so this hook only ever deals with the
 * Spanish draft. `overriding` toggles between "inherit the shop-wide
 * footer" and "use this product's own text".
 */
export function useStep2AiReviewFooter({
  productId,
  initialOverrideEs,
}: {
  productId: string;
  initialOverrideEs: string;
}) {
  const [overriding, setOverriding] = useState(initialOverrideEs.trim() !== "");
  const [draft, setDraft] = useState(initialOverrideEs);
  const [pending, startTransition] = useTransition();

  const startOverride = () => setOverriding(true);

  const save = () => {
    startTransition(async () => {
      const result = await saveListingFooterOverride(productId, draft);
      if (result.ok) {
        // Empty draft clears the override server-side — reflect that by
        // dropping back to the inherited default.
        if (result.footerEsOverride == null) {
          setOverriding(false);
          setDraft("");
        }
        toast.success(m.products.editForm.listingFooter.saved);
      } else {
        toast.error(m.products.editForm.listingFooter.saveFailed, {
          description: result.error,
        });
      }
    });
  };

  const clear = () => {
    startTransition(async () => {
      const result = await saveListingFooterOverride(productId, "");
      if (result.ok) {
        setOverriding(false);
        setDraft("");
        toast.success(m.products.editForm.listingFooter.saved);
      } else {
        toast.error(m.products.editForm.listingFooter.saveFailed, {
          description: result.error,
        });
      }
    });
  };

  return {
    overriding,
    draft,
    setDraft,
    pending,
    startOverride,
    save,
    clear,
  };
}
