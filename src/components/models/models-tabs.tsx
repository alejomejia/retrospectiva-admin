"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import type { AiModelStatus } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { cn } from "@/lib/utils/helpers";

const ORDER: AiModelStatus[] = ["active", "draft", "archived"];

/**
 * Tab switcher for the models gallery — URL state via `?tab=`. The
 * `/models` page reads the same query string server-side and only
 * fetches rows matching the active status, so this is just a
 * shareable link list, no client-side filtering.
 */
export function ModelsTabs({ currentTab }: { currentTab: AiModelStatus }) {
  const pathname = usePathname();
  const sp = useSearchParams();

  return (
    <div className="flex flex-wrap gap-1 border-b border-border" role="tablist">
      {ORDER.map((tab) => {
        const params = new URLSearchParams(sp);
        if (tab === "active") params.delete("tab");
        else params.set("tab", tab);
        const qs = params.toString();
        const href = qs ? `${pathname}?${qs}` : pathname;
        const active = tab === currentTab;
        return (
          <Link
            key={tab}
            href={href}
            role="tab"
            aria-selected={active}
            className={cn(
              "px-3 py-2 text-sm transition-colors border-b-2 -mb-px",
              active
                ? "border-brand-terracotta text-brand-terracotta font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {m.models.tabs[tab]}
          </Link>
        );
      })}
    </div>
  );
}
