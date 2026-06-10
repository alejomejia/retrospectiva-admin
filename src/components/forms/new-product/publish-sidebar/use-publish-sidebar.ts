"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import {
  archiveProduct,
  cancelSchedule,
  markAsSold,
  publishNow,
  restoreToDraft,
  saveDraftAndExit,
  scheduleProduct,
} from "@/lib/products/draft-actions";

import { useAutosave } from "../autosave";
import { useEnrichmentStatusContext } from "../enrichment-status";

export type PublishSidebarMode = "draft" | "edit";

type TerminalOutcome = "completed" | "failed" | "timeout";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

/**
 * Polls `/api/products/{id}/publish-status` until the worker emits a
 * terminal `etsy-publish.*` event or the deadline elapses.
 */
async function pollTerminalEvent(
  productId: string,
): Promise<TerminalOutcome> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        `/api/products/${productId}/publish-status`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          status: string;
          lastEventType: string | null;
        };
        if (data.status === "published") return "completed";
        if (data.lastEventType === "etsy-publish.completed") return "completed";
        if (data.lastEventType === "etsy-publish.failed") return "failed";
      }
    } catch {
      // Network blip — keep polling until the deadline.
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return "timeout";
}

export function usePublishSidebar({
  product,
  mode,
}: {
  product: Product;
  mode: PublishSidebarMode;
}) {
  const router = useRouter();
  const { flush } = useAutosave();
  // Block Publish/Schedule until AI enrichment finishes — publishing a
  // draft mid-enrichment would push empty/partial title/description to Etsy.
  const { phase: enrichmentPhase } = useEnrichmentStatusContext();
  const enrichmentRunning = enrichmentPhase === "running";
  const [scheduledIso, setScheduledIso] = useState<string | null>(
    product.scheduledPublishAt
      ? product.scheduledPublishAt.toISOString()
      : null,
  );
  const [pending, startTransition] = useTransition();

  const onSaveDraft = () => {
    startTransition(async () => {
      // `flush` surfaces its own error toast on failure (autosave
      // provider), so we only need to abort here.
      const flushed = await flush();
      if (!flushed) return;
      const result = await saveDraftAndExit(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(m.toasts.productSaved);
      router.push("/products");
    });
  };

  const onSchedule = () => {
    if (!scheduledIso) {
      toast.error(m.products.stepper.publish.scheduleTimeRequired);
      return;
    }
    startTransition(async () => {
      const flushed = await flush();
      if (!flushed) return;
      const result = await scheduleProduct(product.id, scheduledIso);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(m.products.stepper.publish.scheduledToast);
      router.push("/products");
    });
  };

  const onPublishNow = () => {
    if (!window.confirm(m.products.editForm.etsy.publishNowConfirm)) {
      return;
    }
    startTransition(async () => {
      const flushed = await flush();
      if (!flushed) return;
      const result = await publishNow(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const toastId = toast.loading(
        m.products.editForm.etsy.publishNowRunningToast,
      );
      const outcome = await pollTerminalEvent(product.id);
      if (outcome === "completed") {
        toast.success(m.products.editForm.etsy.publishNowCompletedToast, {
          id: toastId,
        });
      } else if (outcome === "failed") {
        toast.error(m.products.editForm.etsy.publishNowFailedToast, {
          id: toastId,
        });
      } else {
        toast.warning(m.products.editForm.etsy.publishNowTimedOutToast, {
          id: toastId,
        });
      }
      router.push("/products");
    });
  };

  const onCancelSchedule = () => {
    startTransition(async () => {
      const result = await cancelSchedule(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(m.products.editForm.etsy.scheduleCancelledToast);
      router.refresh();
    });
  };

  const onMarkSold = () => {
    if (!window.confirm(m.products.editForm.etsy.markSoldConfirm)) {
      return;
    }
    startTransition(async () => {
      const result = await markAsSold(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(m.products.editForm.etsy.soldToast);
      router.push("/products");
    });
  };

  const onArchive = () => {
    startTransition(async () => {
      const result = await archiveProduct(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(m.products.editForm.etsy.archivedToast);
      router.push("/products");
    });
  };

  const onRestoreToDraft = () => {
    startTransition(async () => {
      const result = await restoreToDraft(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(m.products.editForm.etsy.restoredToast);
      router.refresh();
    });
  };

  return {
    mode,
    scheduledIso,
    setScheduledIso,
    pending,
    enrichmentRunning,
    onSaveDraft,
    onSchedule,
    onPublishNow,
    onCancelSchedule,
    onMarkSold,
    onArchive,
    onRestoreToDraft,
  };
}
