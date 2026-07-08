"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { m } from "@/lib/i18n/messages.en";

import { useStep2AiReviewFooter } from "./use-step-2-ai-review-footer";

/**
 * Step-2 listing-footer field. Shows the shop-wide default footer
 * (read-only, so the operator can confirm the same boilerplate ships
 * on every product) and lets them override it for this product. The
 * override is typed in English only; the save action translates +
 * caches the Spanish at the publish boundary.
 */
export function ListingFooterField({
  productId,
  shopFooterDefaultEn,
  initialOverrideEn,
}: {
  productId: string;
  shopFooterDefaultEn: string;
  initialOverrideEn: string | null;
}) {
  const { overriding, draft, setDraft, pending, startOverride, save, clear } =
    useStep2AiReviewFooter({
      productId,
      initialOverrideEn: initialOverrideEn ?? "",
    });

  const t = m.products.editForm.listingFooter;
  const defaultText = shopFooterDefaultEn.trim();

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <header className="space-y-1">
        <Label className="text-caplet">{t.title}</Label>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </header>

      {!overriding && (
        <div className="space-y-3">
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              {defaultText ? t.usingDefault : t.emptyDefault}
            </p>
            {defaultText && (
              <p className="mt-1 whitespace-pre-wrap text-sm">{defaultText}</p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={startOverride}
          >
            {t.overrideToggle}
          </Button>
        </div>
      )}

      {overriding && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="footer-override-en">{t.overrideLabel}</Label>
            <Textarea
              id="footer-override-en"
              rows={5}
              maxLength={2000}
              value={draft}
              disabled={pending}
              onChange={(e) => setDraft(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t.overrideHelp}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={save}>
              {pending ? t.saving : t.save}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={clear}
            >
              {t.clear}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
