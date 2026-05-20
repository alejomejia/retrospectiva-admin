"use client";

import {
  AlertCircle,
  Archive,
  Loader2,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { useModelGenerationStatus } from "@/components/models/use-model-generation-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  archiveModel,
  discardModel,
  regenerateModel,
  restoreModel,
  retryCropModel,
  saveModel,
} from "@/lib/ai-models/actions";
import type { AiModel, AiModelStatus } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import {
  PANEL_ORDER,
  type PanelKey,
} from "@/lib/integrations/openai/panel-keys";

/**
 * Pre-computed public URLs for every image associated with the
 * model. Resolved server-side in the [id] page so this client
 * component never touches `R2_PUBLIC_BASE_URL` directly (which
 * imports `server-only` and would refuse to bundle).
 */
export type ModelImageUrls = {
  contactSheet: string | null;
  panels: Record<PanelKey, string | null>;
};

export const STATUS_VARIANT: Record<
  AiModelStatus,
  "default" | "secondary" | "outline"
> = {
  active: "default",
  draft: "outline",
  archived: "secondary",
};

/**
 * Single-model detail page. Three states:
 *
 * 1. **Generation in flight** — `contactSheetKey` is null and the
 *    polling endpoint reports a non-terminal run. Renders a skeleton
 *    + spinner.
 * 2. **Generation failed** — polling reports `run.status === 'failed'`.
 *    Renders a banner with the error message + Retry / Discard.
 * 3. **Generation complete** — `contactSheetKey` is non-null.
 *    Renders the contact sheet + the six cropped panels (or a "crops
 *    unavailable" callout if the gutter detector couldn't carve the
 *    grid). Action footer adapts to status: draft → Save/Regenerate/
 *    Discard; active → Regenerate/Archive; archived → Restore.
 */
export function ModelDetailView({
  model,
  urls,
}: {
  model: AiModel;
  urls: ModelImageUrls;
}) {
  const router = useRouter();
  const status = useModelGenerationStatus(model.id);

  // Client-clock millis at which the user last hit Regenerar. Used
  // by `isGenerating` below to flip to the skeleton immediately,
  // before polling has a chance to see the new (running) run row.
  const [kickedAt, setKickedAt] = useState(0);

  const runStatus = status?.run?.status ?? null;
  const runFinishedAtMs = status?.run?.finishedAt
    ? new Date(status.run.finishedAt).getTime()
    : null;

  // Polling refresh on terminal state — pulls fresh row server-side
  // so the detail view re-renders with the new R2 keys.
  useEffect(() => {
    if (runStatus === "succeeded") {
      router.refresh();
    }
  }, [runStatus, router]);

  // Skeleton-vs-preview decision:
  //   - Failure trumps everything; the FailureBanner handles its
  //     own UI.
  //   - If the user just kicked off Regenerar (kickedAt > 0) and
  //     polling still shows a run that finished BEFORE the kick,
  //     we're in the gap between "client clicked" and "worker
  //     wrote the new running row". Treat as generating.
  //   - Otherwise, generating iff the model has no contact sheet
  //     yet — i.e. the first generation hasn't completed.
  const failed = runStatus === "failed" && !model.contactSheetKey;
  const isGenerating = (() => {
    if (failed) return false;
    if (kickedAt > 0) {
      if (runFinishedAtMs === null) return true;
      if (runFinishedAtMs < kickedAt) return true;
    }
    return !model.contactSheetKey;
  })();

  return (
    <div className="space-y-6">
      {isGenerating && <GeneratingPanel />}
      {failed && (
        <FailureBanner
        error={status?.run?.error ?? null}
        modelId={model.id}
        />
      )}

      <IdentityCard model={model} />

      {model.contactSheetKey && !isGenerating && (
        <PreviewSurface model={model} urls={urls} />
      )}

      {!isGenerating && (
        <ActionFooter model={model} onKick={() => setKickedAt(Date.now())} />
      )}
    </div>
  );
}

// ---------- generating ----------

function GeneratingPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Loader2 className="size-4 animate-spin" />
          {m.models.detail.generating}
        </CardTitle>
        <CardDescription>
          {m.models.detail.generatingHint}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Skeleton className="aspect-3/2 w-full" />
      </CardContent>
    </Card>
  );
}

// ---------- failure ----------

function FailureBanner({
  error,
  modelId,
}: {
  error: string | null;
  modelId: string;
}) {
  const router = useRouter();
  const [retryPending, startRetry] = useTransition();
  const [discardPending, startDiscard] = useTransition();

  return (
    <div
      className="flex flex-wrap items-start gap-3 rounded-md border border-brand-terracotta/40 bg-brand-terracotta/5 p-4"
      role="alert"
    >
      <AlertCircle className="mt-0.5 size-5 text-brand-terracotta" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-foreground">
          {m.models.detail.generationFailed}
        </p>
        <p className="text-sm text-muted-foreground">
          {m.models.detail.generationFailedBody}
        </p>
        {error && (
          <p className="text-xs text-muted-foreground" title={error}>
            <code className="font-mono">{truncate(error, 200)}</code>
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={retryPending}
          onClick={() =>
            startRetry(async () => {
              const result = await regenerateModel(modelId);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              router.refresh();
            })
          }
        >
          {m.models.detail.retry}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={discardPending}
          onClick={() => {
            if (!window.confirm(m.models.detail.discardConfirm)) return;
            startDiscard(async () => {
              const result = await discardModel(modelId);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success(m.models.detail.discardedToast);
              router.push("/models");
            });
          }}
        >
          {m.models.detail.discard}
        </Button>
      </div>
    </div>
  );
}

// ---------- preview ----------

function PreviewSurface({
  model,
  urls,
}: {
  model: AiModel;
  urls: ModelImageUrls;
}) {
  const sheetUrl = urls.contactSheet;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="text-base">
              {m.models.detail.contactSheetAlt}
            </CardTitle>
            <CardDescription>
              {model.cropsAvailable
                ? m.models.detail.cropsAvailable
                : m.models.detail.cropsUnavailable}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {sheetUrl && (
            <Image
              src={sheetUrl}
              alt={m.models.detail.contactSheetAlt}
              width={1536}
              height={1024}
              className="w-full rounded-md border border-border"
              unoptimized
            />
          )}
        </CardContent>
      </Card>

      {model.cropsAvailable && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {m.models.detail.panelsHeading}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {PANEL_ORDER.map((panel) => {
                const url = urls.panels[panel];
                if (!url) return null;
                return (
                  <figure key={panel} className="space-y-2">
                    <Image
                      src={url}
                      alt={m.models.detail.panelLabels[panel]}
                      width={400}
                      height={400}
                      className="aspect-square w-full rounded-md border border-border object-cover"
                      unoptimized
                    />
                    <figcaption className="text-xs text-muted-foreground">
                      {m.models.detail.panelLabels[panel]}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- identity card ----------

function IdentityCard({ model }: { model: AiModel }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {m.models.detail.identityHeading}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2">
          <Cell
            label={m.models.new.fields.ageRange}
            value={
              m.models.ageRanges[
                model.ageRange as keyof typeof m.models.ageRanges
              ] ?? model.ageRange
            }
          />
          <Cell
            label={m.models.new.fields.bodyType}
            value={
              m.models.bodyTypes[
                model.bodyType as keyof typeof m.models.bodyTypes
              ] ?? model.bodyType
            }
          />
          <Cell
            label={m.models.new.fields.heightRange}
            value={
              m.models.heightRanges[
                model.heightRange as keyof typeof m.models.heightRanges
              ] ?? model.heightRange
            }
          />
          <Cell
            label={m.models.new.fields.skinTone}
            value={
              m.models.skinTones[
                model.skinTone as keyof typeof m.models.skinTones
              ] ?? model.skinTone
            }
          />
          <Cell
            label={m.models.new.fields.faceShape}
            value={
              m.models.faceShapes[
                model.faceShape as keyof typeof m.models.faceShapes
              ] ?? model.faceShape
            }
          />
          <Cell
            label={m.models.new.fields.hairColor}
            value={
              m.models.hairColors[
                model.hairColor as keyof typeof m.models.hairColors
              ] ?? model.hairColor
            }
          />
          <Cell
            label={m.models.new.fields.hairShape}
            value={
              m.models.hairShapes[
                model.hairShape as keyof typeof m.models.hairShapes
              ] ?? model.hairShape
            }
          />
          <Cell
            label={m.models.new.fields.hairType}
            value={
              m.models.hairTypes[
                model.hairType as keyof typeof m.models.hairTypes
              ] ?? model.hairType
            }
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

// ---------- action footer (status-dependent) ----------

function ActionFooter({
  model,
  onKick,
}: {
  model: AiModel;
  /** Called the instant the user kicks off a new generation, BEFORE
   *  the server action returns. Lets the parent flip to the
   *  skeleton without waiting for the poll loop to catch up. */
  onKick: () => void;
}) {
  const router = useRouter();
  const [savePending, startSave] = useTransition();
  const [regenPending, startRegen] = useTransition();
  const [archivePending, startArchive] = useTransition();
  const [discardPending, startDiscard] = useTransition();
  const [retryCropPending, startRetryCrop] = useTransition();
  const [label, setLabel] = useState("");

  const handleSave = () => {
    startSave(async () => {
      const result = await saveModel(model.id, label);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(m.models.detail.savedToast);
      router.refresh();
    });
  };

  const handleRegen = () => {
    // Flip the parent to skeleton BEFORE the server round-trip so
    // the user sees immediate feedback. The kick timestamp is what
    // `isGenerating` uses to ignore the pre-kick `finishedAt`.
    onKick();
    startRegen(async () => {
      const result = await regenerateModel(model.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleRetryCrop = () => {
    startRetryCrop(async () => {
      const result = await retryCropModel(model.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data.cropsAvailable) {
        toast.success(m.models.detail.retryCropSucceededToast);
        router.refresh();
      } else {
        toast.message(m.models.detail.retryCropStillFailedToast);
      }
    });
  };

  const handleArchive = () => {
    startArchive(async () => {
      const result = await archiveModel(model.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(m.models.detail.archived);
      router.refresh();
    });
  };

  const handleRestore = () => {
    startArchive(async () => {
      const result = await restoreModel(model.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(m.models.detail.restored);
      router.refresh();
    });
  };

  const handleDiscard = () => {
    if (!window.confirm(m.models.detail.discardConfirm)) return;
    startDiscard(async () => {
      const result = await discardModel(model.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(m.models.detail.discardedToast);
      router.push("/models");
    });
  };

  // The action footer changes shape with the model's lifecycle.
  return (
    <Card>
      <CardContent className="py-4">
        {model.status === "draft" && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label htmlFor="model-label" className="text-caplet">
                {m.models.detail.labelLabel}
              </Label>
              <Input
                id="model-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={m.models.detail.labelPlaceholder}
                maxLength={60}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={savePending || label.trim().length === 0}
                className="gap-1.5"
              >
                {savePending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {savePending
                  ? m.models.detail.saving
                  : m.models.detail.save}
              </Button>
              {model.contactSheetKey && !model.cropsAvailable && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRetryCrop}
                  disabled={retryCropPending}
                  className="gap-1.5"
                >
                  {retryCropPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Scissors className="size-4" />
                  )}
                  {retryCropPending
                    ? m.models.detail.retryingCrop
                    : m.models.detail.retryCrop}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={handleRegen}
                disabled={regenPending}
                className="gap-1.5"
              >
                {regenPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {regenPending
                  ? m.models.detail.regenerating
                  : m.models.detail.regenerate}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleDiscard}
                disabled={discardPending}
                className="gap-1.5 text-brand-terracotta hover:text-brand-terracotta"
              >
                <Trash2 className="size-4" />
                {m.models.detail.discard}
              </Button>
            </div>
          </div>
        )}
        {model.status === "active" && (
          <div className="flex flex-wrap justify-end gap-2">
            {model.contactSheetKey && !model.cropsAvailable && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRetryCrop}
                disabled={retryCropPending}
                className="gap-1.5"
              >
                {retryCropPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Scissors className="size-4" />
                )}
                {retryCropPending
                  ? m.models.detail.retryingCrop
                  : m.models.detail.retryCrop}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleRegen}
              disabled={regenPending}
              className="gap-1.5"
            >
              {regenPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {regenPending
                ? m.models.detail.regenerating
                : m.models.detail.regenerate}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleArchive}
              disabled={archivePending}
              className="gap-1.5"
            >
              <Archive className="size-4" />
              {m.models.detail.archive}
            </Button>
          </div>
        )}
        {model.status === "archived" && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleRestore}
              disabled={archivePending}
              className="gap-1.5"
            >
              <RotateCcw className="size-4" />
              {m.models.detail.restore}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
