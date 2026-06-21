"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Delay between the last keystroke and syncing `?q=` to the URL. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Local search box state that mirrors itself into the URL `?q=` param (the
 * server re-queries from there). Debounced so typing doesn't navigate per
 * keystroke; the DB lookup is cheap, but the URL churn isn't worth it.
 * Editing the search clears any selected `?productId=` so the list drives
 * the next selection.
 */
export function useSocialsSearch(initialQuery: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(initialQuery);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the mount pass so we don't navigate to the URL we're already on.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (query) params.set("q", query);
      else params.delete("q");
      params.delete("productId");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // Only the query drives a new sync; pathname/searchParams/router are
    // stable for this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return { query, setQuery };
}
