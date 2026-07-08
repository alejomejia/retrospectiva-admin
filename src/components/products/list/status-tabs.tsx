import Link from "next/link";

import { cn } from "@/lib/utils/helpers";
import { m } from "@/lib/i18n/messages.en";
import {
  DEFAULT_TAB,
  STATUS_TABS,
  type StatusTab,
} from "@/lib/products/filters";

/**
 * Segmented control for status filtering. Tabs are the only status
 * switcher; the filter bar handles everything else.
 *
 * Each tab is an `<a>` to `?tab=…` so the page stays a server
 * component. Switching a tab resets `page` to 1 by omitting it.
 * The default tab key is dropped from the URL.
 */
export function StatusTabs({
  current,
  searchParams,
}: {
  current: StatusTab;
  /** Existing URL params (preserved across tab switches, minus `page`). */
  searchParams: URLSearchParams;
}) {
  return (
    <div
      role="tablist"
      aria-label={m.products.tabs.ariaLabel}
      className="inline-flex flex-wrap items-center gap-1 rounded-full border border-border bg-card p-1"
    >
      {STATUS_TABS.map((tab) => {
        const params = new URLSearchParams(searchParams);
        if (tab === DEFAULT_TAB) params.delete("tab");
        else params.set("tab", tab);
        params.delete("page");
        const href = `/products${params.size > 0 ? `?${params.toString()}` : ""}`;
        const active = current === tab;
        return (
          <Link
            key={tab}
            href={href}
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted",
            )}
          >
            {m.products.tabs[tab]}
          </Link>
        );
      })}
    </div>
  );
}
