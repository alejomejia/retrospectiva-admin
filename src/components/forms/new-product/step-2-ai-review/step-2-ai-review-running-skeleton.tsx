import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/lib/i18n/messages.es";

export function RunningSkeleton() {
  return (
    <div
      className="space-y-4 rounded-md border border-dashed border-border bg-muted/30 p-4"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {m.products.stepper.step2.runningLabel}
      </div>
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-24 w-full" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" />
        ))}
      </div>
    </div>
  );
}
