"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { m } from "@/lib/i18n/messages.es";
import { cn } from "@/lib/utils/helpers";

import { useAutosave } from "./autosave";

/**
 * Small chip in the corner of the stepper showing autosave status:
 * "Guardando…", "Guardado · hace 2s", or an error pill on failure.
 *
 * Re-ticks every 15 s so the relative-time label stays fresh.
 */
export function AutosaveIndicator({ className }: { className?: string }) {
  const { status, lastSavedAt, error } = useAutosave();
  const [ _tick, setTick] = useState(0);

  useEffect(() => {
    if (status !== "saved") return;
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, [status]);

  if (status === "saving") {
    return (
      <span
        className={cn(
          "min-w-37 inline-flex justify-center items-center gap-1.5 text-xs",
          "p-2 text-amber-100 bg-brand-olive-dim rounded-full",
          className,
        )}
        aria-live="polite"
      >
        <Loader2 className="size-4 p-1 bg-brand-olive animate-spin rounded-full" />
        {m.products.stepper.autosave.saving}
      </span>
    );
  }

  if (status === "error") {
    return (
      <span
        className={cn(
          "min-w-37 inline-flex justify-center items-center gap-1.5 text-xs",
          "p-2 text-brand-terracotta-100 bg-brand-terracotta rounded-full",
          className,
        )}
        aria-live="polite"
        title={error ?? undefined}
      >
        <AlertCircle className="size-4 p-1 bg-brand-terracotta-deep rounded-full" />
        {m.products.stepper.autosave.error}
      </span>
    );
  }

  if (status === "saved" && lastSavedAt) {
    return (
      <span
        className={cn(
          "min-w-37 inline-flex justify-center items-center gap-1 text-xs",
          "p-2 text-amber-100 bg-brand-olive rounded-full",
          className,
        )}
        aria-live="polite"
      >
        <Check className="size-4 p-1 bg-brand-olive-deep rounded-full" />
        {m.products.stepper.autosave.savedAgo(relativeFromNow(lastSavedAt))}
      </span>
    );
  }

  return null;
}

function relativeFromNow(d: Date): string {
  const diff = Math.max(0, Date.now() - d.getTime());
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return m.products.stepper.autosave.justNow;
  if (seconds < 60) return m.products.stepper.autosave.secondsAgo(seconds);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return m.products.stepper.autosave.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  return m.products.stepper.autosave.hoursAgo(hours);
}