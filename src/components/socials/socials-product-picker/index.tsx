"use client";

import { Check, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import type { StoryVariantKey } from "@/lib/products/instagram-story-variants";
import { cn } from "@/lib/utils/helpers";

import { useSocialsSearch } from "./use-socials-search";

/** A product as shown in the picker list. */
export type SocialsProductItem = {
  id: string;
  title: string | null;
  status: Product["status"];
  thumbnailUrl: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  published: m.socials.select.statusPublished,
  sold: m.socials.select.statusSold,
};

/**
 * Search box + product grid for a variant page. Typing filters via the URL
 * `?q=` (server re-queries); with no query it shows the latest products.
 * Each tile links to `?productId=`, which makes the studio appear below.
 */
function SocialsProductPickerRoot({
  variant,
  initialQuery,
  items,
  selectedId,
  hasQuery,
}: {
  variant: StoryVariantKey;
  initialQuery: string;
  items: SocialsProductItem[];
  selectedId: string | null;
  hasQuery: boolean;
}) {
  const { query, setQuery } = useSocialsSearch(initialQuery);

  const listLabel = hasQuery
    ? m.socials.select.resultsLabel
    : m.socials.select.latestLabel;

  function hrefFor(id: string): string {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("productId", id);
    return `/socials/${variant}?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={m.socials.select.searchPlaceholder}
          className="pl-9"
        />
      </div>

      <span className="text-caplet text-muted-foreground">{listLabel}</span>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {hasQuery ? m.socials.select.noResults : m.socials.select.empty}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <li key={item.id}>
                <Link href={hrefFor(item.id)} className="group flex flex-col gap-1.5">
                  <div
                    className={cn(
                      "relative w-full overflow-hidden rounded-lg border-2 bg-brand-paper transition-colors",
                      isSelected
                        ? "border-brand-terracotta"
                        : "border-transparent group-hover:border-border",
                    )}
                    style={{ aspectRatio: 9 / 16 }}
                  >
                    {item.thumbnailUrl ? (
                      <Image
                        src={item.thumbnailUrl}
                        alt=""
                        fill
                        sizes="160px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-ink/70 px-1.5 py-0.5 text-caplet text-brand-cream">
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                    {isSelected ? (
                      <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-brand-terracotta text-brand-cream">
                        <Check className="size-3" />
                      </span>
                    ) : null}
                  </div>
                  <span className="line-clamp-2 text-xs text-foreground">
                    {item.title}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const SocialsProductPicker = SocialsProductPickerRoot;
