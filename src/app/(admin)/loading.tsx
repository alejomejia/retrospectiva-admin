import { Skeleton } from "@/components/ui/skeleton";

/**
 * Default loading UI for everything under `(admin)`. Next wraps the
 * page in a `<Suspense>` boundary with this as its fallback, so any
 * server component that awaits data (DB queries, AI calls, etc.)
 * shows this skeleton until the data resolves. The sidebar/topbar
 * stay rendered — only the `<main>` swaps.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-8 p-6">
      <div className="space-y-3 border-b border-border pb-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
