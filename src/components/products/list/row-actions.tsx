"use client";

import { CheckCircle, MoreVertical, Tag, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteProduct } from "@/lib/products/actions";
import { markAsPublished, markAsSold } from "@/lib/products/draft-actions";
import { m } from "@/lib/i18n/messages.es";

import type { ProductListItem } from "./types";

/** Statuses where hard-delete is allowed. Mirrors the server-side
 *  guard in `deleteProduct` so the option simply doesn't render for
 *  rows the server would reject. */
const DELETABLE: ReadonlySet<ProductListItem["status"]> = new Set([
  "draft",
  "archived",
]);

/** Statuses a product can be manually marked sold from. Mirrors
 *  `SELLABLE_STATUSES` in `markAsSold`. */
const SELLABLE: ReadonlySet<ProductListItem["status"]> = new Set([
  "published",
  "scheduled",
  "archived",
]);

/** Statuses a product can be manually marked published from. Mirrors
 *  `PUBLISHABLE_STATUSES` in `markAsPublished` — used to reconcile a
 *  row whose Etsy listing is already live but local status is stale. */
const PUBLISHABLE: ReadonlySet<ProductListItem["status"]> = new Set([
  "scheduled",
  "archived",
]);

export function RowActions({ row }: { row: ProductListItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const canDelete = DELETABLE.has(row.status);
  const canMarkSold = SELLABLE.has(row.status);
  const canMarkPublished = PUBLISHABLE.has(row.status);
  if (!canDelete && !canMarkSold && !canMarkPublished) return null;

  const onDelete = () => {
    if (!window.confirm(m.products.rowActions.confirmDelete)) return;
    startTransition(async () => {
      const result = await deleteProduct(row.id);
      if (result.ok) {
        toast.success(m.products.rowActions.deletedToast);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setOpen(false);
    });
  };

  const onMarkSold = () => {
    if (!window.confirm(m.products.rowActions.confirmMarkSold)) return;
    startTransition(async () => {
      const result = await markAsSold(row.id);
      if (result.ok) {
        toast.success(m.products.rowActions.soldToast);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setOpen(false);
    });
  };

  const onMarkPublished = () => {
    if (!window.confirm(m.products.rowActions.confirmMarkPublished)) return;
    startTransition(async () => {
      const result = await markAsPublished(row.id);
      if (result.ok) {
        toast.success(m.products.rowActions.publishedToast);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setOpen(false);
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={m.products.rowActions.menuLabel}
          disabled={isPending}
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canMarkPublished && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onMarkPublished();
            }}
            disabled={isPending}
          >
            <CheckCircle />
            {m.products.rowActions.markPublished}
          </DropdownMenuItem>
        )}
        {canMarkSold && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onMarkSold();
            }}
            disabled={isPending}
          >
            <Tag />
            {m.products.rowActions.markSold}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              onDelete();
            }}
            disabled={isPending}
          >
            <Trash2 />
            {m.products.rowActions.delete}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
