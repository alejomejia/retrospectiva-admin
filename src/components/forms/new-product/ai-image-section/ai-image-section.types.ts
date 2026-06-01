export type AiImageSectionProduct = {
  id: string;
  aiImageEnabled: boolean | null;
  aiModelId: string | null;
  aiSourcePanel: string | null;
  aiPosePreset: string;
  aiFramingPreset: string;
  aiEnvironmentPreset: string;
  aiFitOverride: string | null;
  aiImageQuality: string;
};

export type AiReferenceImage = {
  url: string;
  width: number | null;
  height: number | null;
} | null;

export type GeneratedAiImage = {
  url: string;
  width: number | null;
  height: number | null;
} | null;
