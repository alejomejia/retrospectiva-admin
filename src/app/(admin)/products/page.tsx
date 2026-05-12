import { desc } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { products, type Product } from "@/lib/db/schema";
import { formatCents } from "@/lib/utils/money";

const STATUS_VARIANT: Record<
  Product["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  published: "default",
  sold: "secondary",
  archived: "outline",
};

export default async function ProductsPage() {
  await requireSession();

  // Phase 2 MVP: pull the latest 100. Real pagination + filtering arrives
  // alongside the activity feed in Phase 8.
  const rows = await db
    .select()
    .from(products)
    .orderBy(desc(products.createdAt))
    .limit(100);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6 border-b border-border pb-6">
        <div className="space-y-3">
          <p className="text-caplet">
            <span className="text-brand-terracotta">02</span>{" "}
            <span>Inventory</span>
          </p>
          <h1 className="font-sans text-4xl font-medium tracking-tight">
            Products
          </h1>
          <p className="max-w-xl text-brand-olive-deep/80">
            Drafts live here until you publish them to Etsy.
          </p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="size-4" />
            New product
          </Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/products/${row.id}`}
                      className="font-medium hover:text-brand-terracotta"
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status]}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCents(row.priceCents, row.currency)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.createdAt.toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-center text-center">
        <CardTitle>No products yet</CardTitle>
        <CardDescription>
          Draft the first piece to start building inventory.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center pb-8">
        <Button asChild>
          <Link href="/products/new">
            <Plus className="size-4" />
            New product
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
