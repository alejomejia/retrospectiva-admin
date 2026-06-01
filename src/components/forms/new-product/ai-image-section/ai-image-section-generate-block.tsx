"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.es";
import { generateProductImage } from "@/lib/products/image-placement-actions";

import { pollPlacementUntilDone } from "./ai-image-section-poll-placement";
import type { GeneratedAiImage } from "./ai-image-section.types";

export function GenerateBlock({
  productId,
  canGenerate,
  initialImage,
  showControls,
}: {
  productId: string;
  canGenerate: boolean;
  initialImage: GeneratedAiImage;
  showControls: boolean;
}) {
  const t = m.products.stepper.step1.aiImageSection;
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<GeneratedAiImage>(initialImage);

  const handle = async (force: boolean) => {
    if (force) {
      if (!window.confirm(t.regenerateConfirm)) return;
    }
    setBusy(true);
    try {
      const startedAt = Date.now();
      const enqueued = await generateProductImage(productId, { force });
      if (!enqueued.ok) {
        toast.error(enqueued.error);
        return;
      }
      toast.message(t.startedToast);
      const result = await pollPlacementUntilDone(productId, startedAt);
      if (!result.ok) {
        toast.error(t.failedToast);
        return;
      }
      setCurrent(result.image);
      toast.success(t.successToast);
    } finally {
      setBusy(false);
    }
  };

  // No controls → render nothing. Step 1 hides both controls and
  // preview; the generated image is shown in step 2 only.
  if (!showControls) return null;

  return (
    <div className="space-y-3">
      {showControls && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => handle(false)}
            disabled={busy || !canGenerate}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t.generating}
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {current ? t.regenerate : t.generate}
              </>
            )}
          </Button>
          {current && (
            <Button
              type="button"
              variant="outline"
              onClick={() => handle(true)}
              disabled={busy}
            >
              <RefreshCw className="size-4" />
              {t.regenerate}
            </Button>
          )}
        </div>
      )}
      {current && (
        <div className="space-y-2">
          <p className="text-caplet">{t.generatedTitle}</p>
          <div className="w-fit overflow-hidden rounded-md border bg-muted">
            <Image
              src={current.url}
              alt=""
              width={current.width ?? 400}
              height={current.height ?? 600}
              className="h-auto w-full max-w-xs"
              unoptimized
            />
          </div>
        </div>
      )}
    </div>
  );
}
