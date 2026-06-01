"use client";

import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { m } from "@/lib/i18n/messages.es";
import {
  deleteAiReferenceImage,
  uploadAiReferenceImage,
} from "@/lib/products/images-actions";
import { compressImage } from "@/lib/utils/compress-image";

import type { AiReferenceImage } from "./ai-image-section.types";

export function ReferenceUploader({
  productId,
  referenceImage,
  onChange,
}: {
  productId: string;
  referenceImage: AiReferenceImage;
  onChange?: (next: AiReferenceImage) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<AiReferenceImage>(referenceImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = m.products.stepper.step1.aiImageSection;

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const { file: compressed, width, height } = await compressImage(file);
      const result = await uploadAiReferenceImage({
        productId,
        file: compressed,
        width,
        height,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Optimistic refresh: blob URL gives instant feedback; the next
      // page navigation will pick up the real R2 URL from the DB.
      const next: AiReferenceImage = {
        url: URL.createObjectURL(compressed),
        width: width ?? null,
        height: height ?? null,
      };
      setCurrent(next);
      onChange?.(next);
      toast.success(t.referenceUploaded);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      const result = await deleteAiReferenceImage(productId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrent(null);
      onChange?.(null);
      toast.success(t.referenceRemoved);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <Label required>{t.referenceTitle}</Label>
        <p className="text-sm text-muted-foreground">
          {t.referenceDescription}
        </p>
      </div>
      <div className="flex items-start gap-4">
        <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {current ? (
            <Image
              src={current.url}
              alt=""
              width={current.width ?? 112}
              height={current.height ?? 112}
              className="size-full object-cover"
              unoptimized
            />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                void handleFile(e.target.files[0]);
              }
              e.target.value = "";
            }}
            disabled={busy}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t.referenceUploading}
              </>
            ) : (
              <>
                <Upload className="size-4" />
                {current ? t.referenceReplace : t.referenceChoose}
              </>
            )}
          </Button>
          {current && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={handleRemove}
            >
              <Trash2 className="size-4" />
              {t.referenceRemove}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
