"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { m } from "@/lib/i18n/messages.en";

const ETSY_LISTING_BASE = "https://retrospectivavintage.etsy.com/listing";

export function CopyListingLinkButton({
  etsyListingId,
}: {
  etsyListingId: number;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${ETSY_LISTING_BASE}/${etsyListingId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(m.products.detail.copyLink.copiedToast);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(m.products.detail.copyLink.failedToast);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          aria-label={m.products.detail.copyLink.label}
        >
          {copied ? (
            <Check className="size-4" />
          ) : (
            <Link2 className="size-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{m.products.detail.copyLink.label}</TooltipContent>
    </Tooltip>
  );
}
