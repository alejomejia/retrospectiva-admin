"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import {
  archiveProduct,
  cancelSchedule,
  publishNow,
  restoreToDraft,
  saveDraftAndExit,
  scheduleProduct,
  updateEtsyListing,
} from "@/lib/products/draft-actions";

import { useAutosave } from "../autosave";

export type PublishSidebarMode = "draft" | "edit";

type TerminalOutcome = "completed" | "failed" | "timeout";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

/**
 * Polls `/api/products/{id}/publish-status` until the worker emits
 * a terminal event for the requested `kind` or the deadline elapses.
 * `kind` switches between the publish and update event families so
 * the same polling helper works for both flows.
 */
async function pollTerminalEvent(
  productId: string,
  kind: "publish" | "update",
): Promise<TerminalOutcome> {
  const completedType = `etsy-${kind}.completed`;
  const failedType = `etsy-${kind}.failed`;
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
        if (kind === "publish" && data.status === "published") {
          return "completed";
        }
        if (data.lastEventType === completedType) return "completed";
        if (data.lastEventType === failedType) return "failed";
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
  const [scheduledIso, setScheduledIso] = useState<string | null>(
    product.scheduledPublishAt
      ? product.scheduledPublishAt.toISOString()
      : null,
  );
  const [pending, startTransition] = useTransition();

  const onSaveDraft = () => {
    startTransition(async () => {
      const flushed = await flush();
      if (!flushed) {
        toast.error(m.errors.couldNotSaveChanges);
        return;
      }
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
      if (!flushed) {
        toast.error(m.errors.couldNotSaveChanges);
        return;
      }
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
      if (!flushed) {
        toast.error(m.errors.couldNotSaveChanges);
        return;
      }
      const result = await publishNow(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const toastId = toast.loading(
        m.products.editForm.etsy.publishNowRunningToast,
      );
      const outcome = await pollTerminalEvent(product.id, "publish");
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

  const onUpdate = () => {
    if (!window.confirm(m.products.stepper.update.confirm)) {
      return;
    }
    startTransition(async () => {
      const flushed = await flush();
      if (!flushed) {
        toast.error(m.errors.couldNotSaveChanges);
        return;
      }
      const result = await updateEtsyListing(product.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const toastId = toast.loading(m.products.stepper.update.runningToast);
      const outcome = await pollTerminalEvent(product.id, "update");
      if (outcome === "completed") {
        toast.success(m.products.stepper.update.completedToast, {
          id: toastId,
        });
        router.refresh();
      } else if (outcome === "failed") {
        toast.error(m.products.stepper.update.failedToast, {
          id: toastId,
        });
      } else {
        toast.warning(m.products.stepper.update.timedOutToast, {
          id: toastId,
        });
      }
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
    onSaveDraft,
    onSchedule,
    onPublishNow,
    onUpdate,
    onCancelSchedule,
    onArchive,
    onRestoreToDraft,
  };
}
