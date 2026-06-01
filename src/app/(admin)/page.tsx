import { Package } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
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
    <>
      <PageHeader>
        <PageHeader.Column className="flex-col">
          <PageHeader.Eyebrow number="01" label={m.dashboard.kicker} />
          <PageHeader.Title>
            Retrospectiva{" "}
            <span className="text-brand-terracotta">Admin</span>
          </PageHeader.Title>
          <PageHeader.Description>
            {m.dashboard.intro(session.username)}
          </PageHeader.Description>
        </PageHeader.Column>
      </PageHeader>

      <main className="p-6">
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
      </main>
    </>
  );
}
