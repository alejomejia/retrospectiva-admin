"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import { createProduct } from "@/lib/products/actions";
import {
  ProductFormSchema,
  type ProductFormValues,
} from "@/lib/products/schema";

/**
 * MVP product form — name + price only. Field set will grow (era,
 * condition, size, fabric, …) but the validation + persistence shape
 * is already wired so adding a field is a one-line zod change plus a
 * matching <FormField> below.
 */
export function ProductForm() {
  const router = useRouter();
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(ProductFormSchema),
    defaultValues: { name: "", priceEur: "" },
  });

  async function onSubmit(values: ProductFormValues) {
    const result = await createProduct(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Product saved as draft");
    router.push(`/products/${result.id}`);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-md space-y-6"
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-caplet">Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoFocus
                  placeholder="1970s Italian wool coat"
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
              <FormLabel className="text-caplet">Price (EUR)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  inputMode="decimal"
                  placeholder="49.99"
                  autoComplete="off"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* TODO(richer-fields): era, condition, size, materials, story,
            measurements, source. Add as zod fields in schema.ts and as
            <FormField> blocks here when ready. */}

        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="w-full sm:w-auto"
        >
          {form.formState.isSubmitting ? "Saving…" : "Save draft"}
        </Button>
      </form>
    </Form>
  );
}
