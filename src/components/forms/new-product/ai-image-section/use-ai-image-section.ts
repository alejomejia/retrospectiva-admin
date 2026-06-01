"use client";

import { useEffect, useState } from "react";

import type { ActiveAiModelListItem } from "@/lib/ai-models/actions";
import type { ClothingType } from "@/lib/db/schema";
import { type PanelKey } from "@/lib/integrations/openai/panel-keys";
import { getDefaultAiSourcePanel } from "@/lib/products/clothing-types";

import { useAutosave } from "../autosave";
import type {
  AiImageSectionProduct,
  AiReferenceImage,
} from "./ai-image-section.types";

type Args = {
  product: AiImageSectionProduct;
  aiModels: ActiveAiModelListItem[];
  referenceImage: AiReferenceImage;
  clothingType: ClothingType | null;
  onAiRequiredStateChange?: (state: {
    modelId: string | null;
    sourcePanel: PanelKey | null;
    hasReference: boolean;
  }) => void;
};

export function useAiImageSection({
  product,
  aiModels,
  referenceImage,
  clothingType,
  onAiRequiredStateChange,
}: Args) {
  const { schedule } = useAutosave();

  // Model + source panel state lives at this level so the preview can
  // join them. The individual selects stay controlled and call back
  // into the parent's setters (which also drive autosave).
  const [modelId, setModelId] = useState<string | null>(product.aiModelId);
  const [sourcePanel, setSourcePanel] = useState<PanelKey | null>(
    product.aiSourcePanel as PanelKey | null,
  );
  const [hasReference, setHasReference] = useState<boolean>(
    referenceImage !== null,
  );

  useEffect(() => {
    onAiRequiredStateChange?.({ modelId, sourcePanel, hasReference });
  }, [modelId, sourcePanel, hasReference, onAiRequiredStateChange]);

  const handleModelChange = (next: string | null) => {
    setModelId(next);
    schedule({ aiModelId: next });
  };
  const handlePanelChange = (next: PanelKey | null) => {
    setSourcePanel(next);
    schedule({ aiSourcePanel: next });
  };
  const handleReferenceChange = (next: AiReferenceImage) => {
    setHasReference(next !== null);
  };

  const selectedModel =
    modelId !== null ? aiModels.find((mm) => mm.id === modelId) ?? null : null;
  const resolvedPanel: PanelKey | null = sourcePanel
    ? sourcePanel
    : clothingType
      ? getDefaultAiSourcePanel(clothingType)
      : null;

  return {
    modelId,
    sourcePanel,
    hasReference,
    selectedModel,
    resolvedPanel,
    handleModelChange,
    handlePanelChange,
    handleReferenceChange,
  };
}
