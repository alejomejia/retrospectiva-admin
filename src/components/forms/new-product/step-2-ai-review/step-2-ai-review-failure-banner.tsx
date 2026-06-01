import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.es";

import { truncate } from "./step-2-ai-review.const";

export function FailureBanner({
  error,
  onRetry,
  retryPending,
}: {
  error: string | null;
  onRetry: () => void;
  retryPending: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-start gap-3 rounded-md border border-brand-terracotta/40 bg-brand-terracotta/5 p-4"
      role="alert"
    >
      <AlertCircle className="mt-0.5 size-5 text-brand-terracotta" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-foreground">
          {m.products.stepper.step2.failedTitle}
        </p>
        <p className="text-sm text-muted-foreground">
          {m.products.stepper.step2.failedBody}
        </p>
        {error && (
          <p className="text-xs text-muted-foreground" title={error}>
            <code className="font-mono">{truncate(error, 200)}</code>
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={retryPending}
        className="gap-1.5"
      >
        <RefreshCw className="size-3.5" />
        {m.products.stepper.step2.retry}
      </Button>
    </div>
  );
}
