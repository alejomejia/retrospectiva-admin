import { Package } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Dashboard landing page. Phase 2 keeps it intentionally minimal —
 * Phase 8 fills it with KPIs, date-range picker, sales chart, and the
 * activity feed.
 */
export default async function Dashboard() {
  const session = await requireSession();

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-caplet">
          <span className="text-brand-terracotta">01</span>{" "}
          <span>Welcome back</span>
        </p>
        <h1 className="font-sans text-5xl font-medium tracking-tight">
          Retrospectiva{" "}
          <span className="text-brand-terracotta">Admin</span>
        </h1>
        <p className="max-w-xl text-brand-olive-deep/80">
          Signed in as{" "}
          <span className="font-medium text-foreground">
            {session.username}
          </span>
          . The dashboard lands in Phase 8 — for now, head to Products to
          start drafting inventory.
        </p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-5" />
              Products
            </CardTitle>
            <CardDescription>
              Draft a new product, attach images, generate AI metadata,
              and publish to Etsy.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            All publishing flows live here. Once a product is published,
            a webhook revalidates the public website automatically.
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/products">Open products</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What&apos;s next</CardTitle>
            <CardDescription>Coming up in later phases.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-inside list-disc space-y-1.5">
              <li>R2 image uploads (Phase 3)</li>
              <li>Etsy OAuth + publish (Phase 4)</li>
              <li>BullMQ background jobs (Phase 5)</li>
              <li>OpenAI description &amp; model placement (Phase 6)</li>
              <li>Webhooks (Phase 7)</li>
              <li>Dashboard KPIs &amp; charts (Phase 8)</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
