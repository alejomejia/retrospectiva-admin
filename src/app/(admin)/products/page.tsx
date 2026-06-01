import { count, desc, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FilterBar } from "@/components/products/list/filter-bar";
import { ProductListShell } from "@/components/products/list/list-shell";
import { Pagination } from "@/components/products/list/pagination";
import { StatusTabs } from "@/components/products/list/status-tabs";
import type { ProductListItem } from "@/components/products/list/types";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { etsyOauth, productImages, products } from "@/lib/db/schema";
import { R2_PUBLIC_BASE_URL } from "@/lib/integrations/r2/client";
import { publicUrlFor } from "@/lib/integrations/r2/keys";
import { m } from "@/lib/i18n/messages.es";
import {
  buildProductsWhere,
  parseProductListParams,
} from "@/lib/products/filters";
import { DEFAULT_MARKUP_PERCENT, effectiveListCents } from "@/lib/products/pricing";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const sp = await searchParams;
  const params = parseProductListParams(sp);
  const where = buildProductsWhere(params);

  // Shop-wide markup. There's only one row in `etsy_oauth` (or none,
  // pre-connection), so `limit(1)` is enough.
  const [oauthRow] = await db
    .select({ markupPercent: etsyOauth.markupPercent })
    .from(etsyOauth)
    .limit(1);
  const shopMarkupPercent = oauthRow?.markupPercent ?? DEFAULT_MARKUP_PERCENT;

  const offset = (params.page - 1) * params.pageSize;

  const [productRows, totalResult] = await Promise.all([
    db
      .select({
        id: products.id,
        titleEs: products.titleEs,
        status: products.status,
        basePriceCents: products.basePriceCents,
        currency: products.currency,
        markupPercentOverride: products.markupPercentOverride,
        listPriceCentsOverride: products.listPriceCentsOverride,
        createdAt: products.createdAt,
      })
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt))
      .limit(params.pageSize)
      .offset(offset),
    db
      .select({ value: count() })
      .from(products)
      .where(where),
  ]);

  const totalCount = totalResult[0]?.value ?? 0;

  // First image (lowest `order`) per product, in one query. We use
  // DISTINCT ON to pick the smallest-order row per product_id.
  const productIds = productRows.map((r) => r.id);
  const thumbnails =
    productIds.length === 0
      ? []
      : await db.execute<{ product_id: string; r2_key: string }>(
          sql`SELECT DISTINCT ON (${productImages.productId})
              ${productImages.productId} AS product_id,
              ${productImages.r2Key} AS r2_key
            FROM ${productImages}
            WHERE ${productImages.productId} IN ${productIds}
              AND ${productImages.role} = 'original'
            ORDER BY ${productImages.productId}, ${productImages.order} ASC`,
        );
  const thumbByProductId = new Map<string, string>();
  for (const t of thumbnails) {
    thumbByProductId.set(t.product_id, publicUrlFor(t.r2_key, R2_PUBLIC_BASE_URL));
  }

  const rows: ProductListItem[] = productRows.map((r) => ({
    id: r.id,
    titleEs: r.titleEs,
    status: r.status,
    basePriceCents: r.basePriceCents,
    currency: r.currency,
    createdAt: r.createdAt,
    thumbnailUrl: thumbByProductId.get(r.id) ?? null,
    effectiveListPriceCents: effectiveListCents({
      basePriceCents: r.basePriceCents,
      markupPercentOverride: r.markupPercentOverride,
      listPriceCentsOverride: r.listPriceCentsOverride,
      shopMarkupPercent,
    }),
  }));

  const searchParamsObj = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      typeof v === "string" ? [[k, v] as [string, string]] : [],
    ),
  );

  const showingFrom = totalCount === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + rows.length, totalCount);
  const totalLabel = m.products.pagination.showing(
    showingFrom,
    showingTo,
    totalCount,
  );

  return (
    <>
      <PageHeader>
        <PageHeader.Column className="flex-1 flex-col">
          <PageHeader.Eyebrow number="02" label={m.products.kicker} />
          <PageHeader.Title>{m.products.title}</PageHeader.Title>
          <PageHeader.Description>
            {m.products.description}
          </PageHeader.Description>
        </PageHeader.Column>
        <PageHeader.Column className="self-end content-end">
          <Button asChild>
            <Link href="/products/new">
              <Plus className="size-4" />
              {m.products.newProduct}
            </Link>
          </Button>
        </PageHeader.Column>
      </PageHeader>

      <main className="p-6">
        <div className="space-y-4">
          <div className="flex gap-4">
            <StatusTabs current={params.tab} searchParams={searchParamsObj} />
            <div className="flex-1">
              <FilterBar />
            </div>
          </div>

          {totalCount === 0 ? (
            <EmptyState />
          ) : (
            <>
              <ProductListShell rows={rows} totalLabel={totalLabel} />
              <Pagination
                page={params.page}
                pageSize={params.pageSize}
                totalCount={totalCount}
              />
            </>
          )}
        </div>
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-center text-center">
        <CardTitle>{m.products.empty.title}</CardTitle>
        <CardDescription>{m.products.empty.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center pb-8">
        <Button asChild>
          <Link href="/products/new">
            <Plus className="size-4" />
            {m.products.newProduct}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

