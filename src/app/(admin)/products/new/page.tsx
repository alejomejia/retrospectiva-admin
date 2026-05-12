import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ProductForm } from "@/components/products/product-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/require-session";

export default async function NewProductPage() {
  await requireSession();

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
        <h1 className="font-sans text-4xl font-medium tracking-tight">
          New product
        </h1>
        <p className="max-w-xl text-brand-olive-deep/80">
          Save as a draft now; richer fields, images, AI, and Etsy publish
          come from the detail page once it&apos;s saved.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Name and price are required. Other fields land in later phases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm />
        </CardContent>
      </Card>
    </div>
  );
}
