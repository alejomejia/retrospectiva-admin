import { ColumnSelector } from "./column-selector";
import { ProductsTable } from "./products-table";
import type { ProductListItem } from "./types";

/**
 * Renders the column selector + table. Column preferences are
 * stored in `localStorage` via a module-level `useSyncExternalStore`
 * (see `column-prefs.tsx`) — no provider needed.
 */
export function ProductListShell({
  rows,
  totalLabel,
}: {
  rows: ProductListItem[];
  /** Pre-formatted "Mostrando 1–20 de 137" string from the server. */
  totalLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-caplet text-muted-foreground">
          {totalLabel}
        </span>
        <ColumnSelector />
      </div>
      <ProductsTable rows={rows} />
    </div>
  );
}
