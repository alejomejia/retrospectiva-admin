"use client";

import { MoreVertical, Trash2 } from "lucide-react";
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
import { m } from "@/lib/i18n/messages.es";

import type { ProductListItem } from "./types";

/** Statuses where hard-delete is allowed. Mirrors the server-side
 *  guard in `deleteProduct` so the option simply doesn't render for
 *  rows the server would reject. */
const DELETABLE: ReadonlySet<ProductListItem["status"]> = new Set([
  "draft",
  "archived",
]);

export function RowActions({ row }: { row: ProductListItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const canDelete = DELETABLE.has(row.status);
  if (!canDelete) return null;

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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
