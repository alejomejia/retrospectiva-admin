"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { updateProduct } from "@/lib/products/actions";
import {
  ProductFormSchema,
  type ProductFormValues,
} from "@/lib/products/schema";
import { centsToPriceEur } from "@/lib/utils/money";

/**
 * The form that powers both creating and editing products. Used by the
 * details card's edit toggle. When the parent passes `startInEditMode`
 * (from the `/products/new` auto-draft flow), this is what the user
 * sees first thing — prefilled with the placeholder name + 0 EUR ready
 * to be replaced.
 */
export function ProductEditForm({
  product,
  onDone,
}: {
  product: Product;
  onDone: () => void;
}) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(ProductFormSchema),
    defaultValues: {
      name: product.name,
      priceEur: centsToPriceEur(product.priceCents),
    },
  });

  async function onSubmit(values: ProductFormValues) {
    const result = await updateProduct(product.id, values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(m.toasts.productUpdated);
    onDone();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-caplet">{m.products.form.name}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoFocus
                  placeholder={m.products.form.namePlaceholder}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="priceEur"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-caplet">{m.products.form.priceEur}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={m.products.form.pricePlaceholder}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? m.common.saving : m.common.saveChanges}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onDone}
            disabled={form.formState.isSubmitting}
          >
            {m.common.cancel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
