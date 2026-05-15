"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { ProductEditForm } from "@/components/products/product-edit-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { formatCents } from "@/lib/utils/money";

/**
 * Detail-page "Details" card with an edit toggle. Default view is
 * read-only with an Edit button; clicking it swaps the same card
 * surface to `ProductEditForm`. Save flips back to view; revalidatePath
 * inside `updateProduct` re-renders the server page so the new data
 * propagates to this component's props.
 *
 * `startInEditMode` lets the parent open the card directly in edit
 * mode — used by the auto-created-draft flow at `/products/new` so the
 * user lands ready to type the real name + price.
 */
export function ProductDetailsCard({
  product,
  startInEditMode = false,
}: {
  product: Product;
  startInEditMode?: boolean;
}) {
  const [editing, setEditing] = useState(startInEditMode);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.products.detail.detailsTitle}</CardTitle>
        <CardDescription>
          {editing
            ? m.products.detail.editingHint
            : m.products.detail.detailsDescription}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {editing ? (
          <ProductEditForm
            product={product}
            onDone={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={m.products.detail.fields.price}
                value={formatCents(product.priceCents, product.currency)}
              />
              <Field
                label={m.products.detail.fields.currency}
                value={product.currency}
              />
              <Field
                label={m.products.detail.fields.created}
                value={product.createdAt.toLocaleString("es-ES")}
              />
              <Field
                label={m.products.detail.fields.updated}
                value={product.updatedAt.toLocaleString("es-ES")}
              />
            </div>
            <Separator />
            <Field
              label={m.products.detail.fields.id}
              value={product.id}
              mono
            />
          </>
        )}
      </CardContent>

      {!editing && (
        <CardFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" />
            {m.products.detail.editButton}
          </Button>
        </CardFooter>
      )}
    </Card>
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
