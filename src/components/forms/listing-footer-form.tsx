"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { m } from "@/lib/i18n/messages.en";
import { saveListingFooter } from "@/lib/products/settings-actions";

type Props = {
  currentFooterEs: string;
  currentFooterEn: string;
};

export function ListingFooterForm({ currentFooterEs, currentFooterEn }: Props) {
  const [footerEs, setFooterEs] = useState(currentFooterEs);
  const [footerEn, setFooterEn] = useState(currentFooterEn);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveListingFooter({
        listingFooterEs: footerEs,
        listingFooterEn: footerEn,
      });
      if (result.ok) {
        toast.success(m.settings.products.saved);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="footer-es">
            {m.settings.products.footer.labelEs}
          </Label>
          <Textarea
            id="footer-es"
            rows={5}
            maxLength={2000}
            value={footerEs}
            placeholder={m.settings.products.footer.placeholderEs}
            onChange={(e) => setFooterEs(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="footer-en">
            {m.settings.products.footer.labelEn}
          </Label>
          <Textarea
            id="footer-en"
            rows={5}
            maxLength={2000}
            value={footerEn}
            placeholder={m.settings.products.footer.placeholderEn}
            onChange={(e) => setFooterEn(e.target.value)}
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {m.settings.products.footer.help}
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? m.settings.products.saving : m.settings.products.save}
      </Button>
    </form>
  );
}
