import type { ActiveAiModelListItem } from "@/lib/ai-models/actions";
import type { PanelKey } from "@/lib/integrations/openai/panel-keys";

export const FIT_NONE_VALUE = "__none__";
export const PANEL_AUTO_VALUE = "__auto__";

/** Polling cadence + ceiling for the generation flow. Mirrors the
 *  enrich-regenerate path on the edit form. */
export const POLL_INTERVAL_MS = 2500;
export const POLL_MAX_ATTEMPTS = 96; // ~4 minutes; gpt-image-2 high portrait ~60s

/** Map PanelKey → ActiveAiModelListItem column carrying the R2 key. */
export const PANEL_TO_KEY: Record<
  PanelKey,
  keyof Pick<
    ActiveAiModelListItem,
    | "frontFullKey"
    | "frontPortraitKey"
    | "frontEditorialKey"
    | "sidePortraitKey"
    | "backFullKey"
    | "threequarterFullKey"
  >
> = {
  front_full: "frontFullKey",
  front_portrait: "frontPortraitKey",
  front_editorial: "frontEditorialKey",
  side_portrait: "sidePortraitKey",
  back_full: "backFullKey",
  threequarter_full: "threequarterFullKey",
};
