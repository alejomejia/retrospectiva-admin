import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getProduct } from "@/lib/products/actions";
import { formatCents } from "@/lib/utils/money";

/**
 * Phase 2 detail view: read-only confirmation that the draft was saved.
 * Phase 3 attaches images, Phase 4 adds the Etsy publish action,
 * Phase 6 wires the AI enrichment panel.
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <div className="space-y-8">
      <header className="space-y-3 border-b border-border pb-6">
        <Link
          href="/products"
          className="text-caplet inline-flex items-center gap-1.5 hover:text-brand-terracotta"
        >
          <ArrowLeft className="size-3" />
          Products
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-sans text-4xl font-medium tracking-tight">
            {product.name}
          </h1>
          <Badge
            variant={product.status === "draft" ? "outline" : "default"}
            className="text-caplet"
          >
            {product.status}
          </Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Draft saved</CardTitle>
          <CardDescription>
            Phase 3 attaches images, Phase 4 publishes to Etsy, Phase 6
            generates the description + model placement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price" value={formatCents(product.priceCents, product.currency)} />
            <Field label="Currency" value={product.currency} />
            <Field
              label="Created"
              value={product.createdAt.toLocaleString()}
            />
            <Field
              label="Updated"
              value={product.updatedAt.toLocaleString()}
            />
          </div>
          <Separator />
          <Field label="ID" value={product.id} mono />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-caplet">{label}</p>
      <p className={mono ? "font-mono text-sm" : "text-sm"}>{value}</p>
    </div>
  );
}
