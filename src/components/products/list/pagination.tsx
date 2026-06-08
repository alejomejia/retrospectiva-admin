"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { m } from "@/lib/i18n/messages.es";
import { PAGE_SIZES, type PageSize } from "@/lib/products/filters";

/**
 * Page-based pagination. Prev/next change `?page=…`; the size selector
 * changes `?pageSize=…` and resets to page 1.
 */
export function Pagination({
  page,
  pageSize,
  totalCount,
}: {
  page: number;
  pageSize: PageSize;
  totalCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const goto = (nextPage: number, nextPageSize: PageSize) => {
    const params = new URLSearchParams(searchParams);
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    if (nextPageSize === 20) params.delete("pageSize");
    else params.set("pageSize", String(nextPageSize));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Single page → nothing to paginate; hide the whole control.
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{m.products.pagination.pageSize}</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => goto(1, Number(v) as PageSize)}
        >
          <SelectTrigger size="sm" className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => goto(page - 1, pageSize)}
          disabled={page <= 1}
          aria-label={m.products.pagination.prev}
        >
          <ChevronLeft className="size-4" />
          {m.products.pagination.prev}
        </Button>
        <span className="text-sm text-muted-foreground">
          {m.products.pagination.pageOf(page, totalPages)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => goto(page + 1, pageSize)}
          disabled={page >= totalPages}
          aria-label={m.products.pagination.next}
        >
          {m.products.pagination.next}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
