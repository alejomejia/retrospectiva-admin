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
import { m } from "@/lib/i18n/messages.es";

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
          <span>{m.dashboard.kicker}</span>
        </p>
        <h1 className="font-sans text-5xl font-medium tracking-tight">
          Retrospectiva{" "}
          <span className="text-brand-terracotta">Admin</span>
        </h1>
        <p className="max-w-xl text-brand-olive-deep/80">
          {m.dashboard.intro(session.username)}
        </p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-5" />
              {m.dashboard.productsCard.title}
            </CardTitle>
            <CardDescription>
              {m.dashboard.productsCard.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {m.dashboard.productsCard.body}
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/products">{m.dashboard.productsCard.cta}</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{m.dashboard.nextCard.title}</CardTitle>
            <CardDescription>{m.dashboard.nextCard.description}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-inside list-disc space-y-1.5">
              {m.dashboard.nextCard.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
