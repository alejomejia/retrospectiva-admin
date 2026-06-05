"use client";

import { Image as ImageIcon, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { m } from "@/lib/i18n/messages.es";
import { formatCents } from "@/lib/utils/money";
import { cn } from "@/lib/utils/helpers";

import { useColumnPrefs } from "./column-prefs";
import { COLUMN_LABELS } from "./column-selector";
import { RowActions } from "./row-actions";
import type { ColumnKey, ProductListItem } from "./types";

const STATUS_VARIANT: Record<
  ProductListItem["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  scheduled: "secondary",
  published: "default",
  sold: "secondary",
  archived: "outline",
};

const RIGHT_ALIGNED: ColumnKey[] = ["price", "createdAt"];

export function ProductsTable({ rows }: { rows: ProductListItem[] }) {
  const { prefs } = useColumnPrefs();
  const visible = prefs.filter((p) => p.visible).map((p) => p.key);
  if (rows.length === 0 || visible.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {visible.map((key) => (
              <TableHead
                key={key}
                className={cn(
                  key === "thumbnail" && "w-16",
                  RIGHT_ALIGNED.includes(key) && "text-right",
                )}
              >
                {COLUMN_LABELS[key]}
              </TableHead>
            ))}
            <TableHead className="w-12">
              <span className="sr-only">{m.products.rowActions.menuLabel}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {visible.map((key) => (
                <Cell key={key} columnKey={key} row={row} />
              ))}
              <TableCell className="w-12 text-right">
                <RowActions row={row} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Cell({
  columnKey,
  row,
}: {
  columnKey: ColumnKey;
  row: ProductListItem;
}) {
  switch (columnKey) {
    case "thumbnail":
      return (
        <TableCell className="w-16">
          <Link
            href={`/products/${row.id}`}
            aria-label={row.titleEs ?? m.products.detail.untitled}
            className="block size-32 overflow-hidden rounded-sm border border-border bg-muted"
          >
            {row.thumbnailUrl ? (
              <Image
                src={row.thumbnailUrl}
                alt=""
                width={48}
                height={48}
                className="size-full object-cover"
                unoptimized
              />
            ) : (
              <span className="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon className="size-4" />
              </span>
            )}
          </Link>
        </TableCell>
      );
    case "title":
      return (
        <TableCell>
          <div className="flex items-center gap-1.5">
            {row.isFeatured ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Star
                    className="size-4 shrink-0 fill-brand-terracotta text-brand-terracotta"
                    aria-label={m.products.list.featuredLabel}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {m.products.list.featuredLabel}
                </TooltipContent>
              </Tooltip>
            ) : null}
            <Link
              href={`/products/${row.id}`}
              className="font-medium hover:text-brand-terracotta"
            >
              {row.titleEs ?? m.products.detail.untitled}
            </Link>
          </div>
        </TableCell>
      );
    case "status":
      return (
        <TableCell>
          <Badge variant={STATUS_VARIANT[row.status]}>
            {m.products.statuses[row.status]}
          </Badge>
        </TableCell>
      );
    case "price":
      return (
        <TableCell className="text-right font-mono tabular-nums">
          {row.effectiveListPriceCents !== null
            ? formatCents(row.effectiveListPriceCents, row.currency)
            : "—"}
        </TableCell>
      );
    case "createdAt":
      return (
        <TableCell className="text-right text-muted-foreground">
          {row.createdAt.toLocaleDateString("es-ES")}
        </TableCell>
      );
  }
}
