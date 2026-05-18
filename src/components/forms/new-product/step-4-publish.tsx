"use client";

import { CalendarClock, FileText, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import {
  saveDraftAndExit,
  scheduleProduct,
} from "@/lib/products/draft-actions";

import { useAutosave } from "./autosave-context";
import { SchedulePicker } from "./schedule-picker";

/**
 * Step 4 — three terminal actions. "Save draft" + "Publish now" wire
 * through to existing/stubbed paths; "Schedule" persists the chosen
 * datetime via the autosave context and flips the row to
 * `status='scheduled'`. The actual BullMQ delayed-job hookup lands
 * in Task 9; until then this records the intent in the DB only.
 */
export function Step4Publish({
  product,
  onPrev,
}: {
  product: Product;
  onPrev: () => void;
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
      // Flush any other autosave-pending edits first; the schedule
      // action itself sets status + scheduled_publish_at atomically.
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
    // TODO(task-9 / phase-4c): enqueue an immediate `etsy-publish`
    // job. Until the publish processor exists, surface a clear
    // "not yet implemented" toast so the user isn't confused.
    toast(m.products.stepper.publish.publishNotYet);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-5 text-brand-terracotta" />
          {m.products.stepper.publish.title}
        </CardTitle>
        <CardDescription>
          {m.products.stepper.publish.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <section className="space-y-3 rounded-md border border-border bg-card p-4">
          <h3 className="text-caplet flex items-center gap-2">
            <Send className="size-4" />
            {m.products.stepper.publish.publishNow}
          </h3>
          <p className="text-sm text-muted-foreground">
            {m.products.stepper.publish.publishNowHelp}
          </p>
          <Button type="button" disabled={pending} onClick={onPublishNow}>
            {m.products.stepper.publish.publishNow}
          </Button>
        </section>

        <section className="space-y-3 rounded-md border border-border bg-card p-4">
          <h3 className="text-caplet flex items-center gap-2">
            <FileText className="size-4" />
            {m.products.stepper.publish.saveDraft}
          </h3>
          <p className="text-sm text-muted-foreground">
            {m.products.stepper.publish.saveDraftHelp}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onSaveDraft}
          >
            {m.products.stepper.publish.saveDraft}
          </Button>
        </section>

        <section className="space-y-3 rounded-md border border-border bg-card p-4">
          <h3 className="text-caplet flex items-center gap-2">
            <CalendarClock className="size-4" />
            {m.products.stepper.publish.scheduleButton}
          </h3>
          <p className="text-sm text-muted-foreground">
            {m.products.stepper.publish.scheduleHelp}
          </p>
          <SchedulePicker
            value={scheduledIso}
            onChange={setScheduledIso}
            disabled={pending}
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending || !scheduledIso}
            onClick={onSchedule}
          >
            {m.products.stepper.publish.scheduleButton}
          </Button>
        </section>

        <div className="flex justify-start">
          <Button type="button" variant="ghost" onClick={onPrev}>
            {m.products.stepper.prev}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
