"use client";

import { Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { m } from "@/lib/i18n/messages.es";

import { useMarkSoldDialog } from "./use-mark-sold-dialog";

/**
 * Controlled dialog that collects the required actual sale price before
 * marking a product sold. The parent owns `open`/`pending` and runs the
 * server action in `onConfirm`, which receives the price in cents.
 * Shared between the products-list row menu and the edit-form sidebar.
 */
export function MarkSoldDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (soldPriceCents: number) => void;
  pending: boolean;
}) {
  const vm = useMarkSoldDialog(onConfirm);

  const handleOpenChange = (next: boolean) => {
    if (!next) vm.reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{m.products.markSold.dialogTitle}</DialogTitle>
          <DialogDescription>
            {m.products.markSold.dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="sold-price" className="text-caplet" required>
            {m.products.markSold.priceLabel}
          </Label>
          <Input
            id="sold-price"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={vm.priceStr}
            onChange={(e) => vm.setPriceStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                vm.submit();
              }
            }}
            className="w-40"
            aria-invalid={vm.error !== null}
            autoFocus
          />
          {vm.error && (
            <p className="text-xs text-brand-terracotta">{vm.error}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {m.products.markSold.priceHint}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            {m.products.markSold.cancel}
          </Button>
          <Button type="button" onClick={vm.submit} disabled={pending}>
            <Tag className="size-4" />
            {m.products.markSold.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
