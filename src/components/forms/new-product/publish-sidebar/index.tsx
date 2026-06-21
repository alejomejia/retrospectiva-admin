"use client";

import {
  Archive,
  CalendarClock,
  Clock,
  FileText,
  Globe,
  RotateCcw,
  Send,
  Settings,
  Tag,
  XCircle,
} from "lucide-react";

import { MarkSoldDialog } from "@/components/products/mark-sold-dialog";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";

import { SchedulePicker } from "../schedule-picker";
import {
  type PublishSidebarMode,
  usePublishSidebar,
} from "./use-publish-sidebar";

/**
 * Right-rail action sidebar shared between the new-product stepper
 * and the edit stepper. The visible actions depend on `mode`:
 *
 * - `draft`: Publish now / Save draft / Schedule (legacy flow).
 * - `edit`:  Actualizar en Etsy / Archivar / Restaurar borrador /
 *            Cancelar programación, depending on status.
 *
 * Schedule is only meaningful in `draft` mode — once published the
 * listing is live, and re-scheduling would be ambiguous.
 */
export function PublishSidebar({
  product,
  etsyPoliciesConfigured,
  mode,
}: {
  product: Product;
  etsyPoliciesConfigured: boolean;
  mode: PublishSidebarMode;
}) {
  const vm = usePublishSidebar({ product, mode });

  if (mode === "edit") {
    return (
      <aside className="sticky top-0">
        <header className="p-6 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="size-5 text-brand-terracotta" />
            <h2 className="font-semibold">
              {m.products.stepper.actions.title}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {m.products.stepper.actions.description}
          </p>
          <div className="flex flex-col gap-3">
            {product.etsyListingId != null && (
              <Button
                type="button"
                className="p-6"
                disabled={vm.pending}
                onClick={vm.onUpdateWebsite}
              >
                <Globe className="size-4" />
                {m.products.editForm.etsy.updateWeb}
              </Button>
            )}

            {(product.status === "published" ||
              product.status === "scheduled") && (
              <Button
                type="button"
                className="p-6"
                disabled={vm.pending}
                onClick={vm.onMarkSold}
              >
                <Tag className="size-4" />
                {m.products.editForm.etsy.markSold}
              </Button>
            )}

            {product.status === "scheduled" && (
              <Button
                type="button"
                className="p-6"
                variant="outline"
                disabled={vm.pending}
                onClick={vm.onCancelSchedule}
              >
                <XCircle className="size-4" />
                {m.products.editForm.etsy.cancelSchedule}
              </Button>
            )}

            {(product.status === "published" ||
              product.status === "scheduled" ||
              product.status === "sold") && (
              <Button
                type="button"
                variant="outline"
                className="p-6"
                disabled={vm.pending}
                onClick={vm.onArchive}
              >
                <Archive className="size-4" />
                {m.products.editForm.etsy.archive}
              </Button>
            )}

            {(product.status === "archived" || product.status === "sold") && (
              <Button
                type="button"
                variant="outline"
                className="p-6"
                disabled={vm.pending}
                onClick={vm.onRestoreToDraft}
              >
                <RotateCcw className="size-4" />
                {m.products.editForm.etsy.restoreToDraft}
              </Button>
            )}
          </div>
        </header>

        <MarkSoldDialog
          open={vm.soldDialogOpen}
          onOpenChange={vm.setSoldDialogOpen}
          onConfirm={vm.onConfirmSold}
          pending={vm.pending}
        />
      </aside>
    );
  }

  return (
    <aside className="sticky top-0">
      <header className="p-6 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Send className="size-5 text-brand-terracotta" />
          <h2 className="font-semibold">{m.products.stepper.publish.title}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {m.products.stepper.publish.description}
        </p>
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            className="p-6"
            disabled={
              vm.pending || vm.enrichmentRunning || !etsyPoliciesConfigured
            }
            onClick={vm.onPublishNow}
          >
            <Send className="size-4" />
            {m.products.stepper.publish.publishNow}
          </Button>
          <Button
            type="button"
            className="p-6"
            variant="outline"
            disabled={vm.pending}
            onClick={vm.onSaveDraft}
          >
            <FileText className="size-4" />
            {m.products.stepper.publish.saveDraft}
          </Button>
        </div>
      </header>

      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-caplet flex items-center gap-2 mb-2">
            <CalendarClock className="size-4" />
            {m.products.stepper.publish.scheduleButton}
          </h3>
          <p className="text-sm text-muted-foreground">
            {m.products.stepper.publish.scheduleHelp}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <SchedulePicker
            value={vm.scheduledIso}
            onChange={vm.setScheduledIso}
            disabled={
              vm.pending || vm.enrichmentRunning || !etsyPoliciesConfigured
            }
          />
          <Button
            type="button"
            className="p-6"
            variant="outline"
            disabled={
              vm.pending ||
              vm.enrichmentRunning ||
              !vm.scheduledIso ||
              !etsyPoliciesConfigured
            }
            onClick={vm.onSchedule}
          >
            <Clock className="size-4" />
            {m.products.stepper.publish.scheduleButton}
          </Button>
        </div>
      </div>
    </aside>
  );
}
