"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { m } from "@/lib/i18n/messages.en";
import { cn } from "@/lib/utils/helpers";

/**
 * Search + price + date-range controls for /products. Every change
 * updates URL search params via `router.replace`, which causes the
 * server page to re-query the DB. The search input debounces.
 */
export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutator(next);
      next.delete("page");
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  // Search — debounced 250 ms.
  const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(debounceRef.current ?? 0), []);
  const onSearchChange = (next: string) => {
    setSearchValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      update((p) => {
        const trimmed = next.trim();
        if (trimmed) p.set("q", trimmed);
        else p.delete("q");
      });
    }, 250);
  };

  // Price range — committed on blur.
  const priceMin = searchParams.get("priceMin") ?? "";
  const priceMax = searchParams.get("priceMax") ?? "";
  const commitPrice = (key: "priceMin" | "priceMax") => (raw: string) => {
    update((p) => {
      const trimmed = raw.trim();
      if (trimmed) p.set(key, trimmed);
      else p.delete(key);
    });
  };

  // Date range — committed when the popover closes (Calendar onSelect).
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const dateRange = useMemo<DateRange | undefined>(() => {
    const f = from ? new Date(from) : undefined;
    const t = to ? new Date(to) : undefined;
    if (!f && !t) return undefined;
    return { from: f, to: t };
  }, [from, to]);
  const onRange = (next: DateRange | undefined) => {
    update((p) => {
      if (next?.from) p.set("from", format(next.from, "yyyy-MM-dd"));
      else p.delete("from");
      if (next?.to) p.set("to", format(next.to, "yyyy-MM-dd"));
      else p.delete("to");
    });
  };

  const hasAnyFilter = !!(searchValue || priceMin || priceMax || from || to);
  const clearAll = () => {
    setSearchValue("");
    update((p) => {
      p.delete("q");
      p.delete("priceMin");
      p.delete("priceMax");
      p.delete("from");
      p.delete("to");
    });
  };

  return (
    <div
      data-pending={pending || undefined}
      className="flex flex-wrap items-center gap-3"
    >
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          inputMode="search"
          placeholder={m.products.filters.searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          aria-label={m.products.filters.searchLabel}
        />
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder={m.products.filters.priceMinPlaceholder}
          defaultValue={priceMin}
          onBlur={(e) => commitPrice("priceMin")(e.target.value)}
          className="w-28"
          aria-label={m.products.filters.priceMinLabel}
        />
        <span className="text-sm text-muted-foreground">—</span>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder={m.products.filters.priceMaxPlaceholder}
          defaultValue={priceMax}
          onBlur={(e) => commitPrice("priceMax")(e.target.value)}
          className="w-28"
          aria-label={m.products.filters.priceMaxLabel}
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "gap-2",
              !dateRange && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <span>
                  {format(dateRange.from, "dd MMM")} —{" "}
                  {format(dateRange.to, "dd MMM")}
                </span>
              ) : (
                format(dateRange.from, "dd MMM yyyy")
              )
            ) : (
              m.products.filters.dateRangePlaceholder
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={onRange}
            numberOfMonths={2}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>

      {hasAnyFilter && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="gap-1"
        >
          <X className="size-3.5" />
          {m.products.filters.clearAll}
        </Button>
      )}
    </div>
  );
}
