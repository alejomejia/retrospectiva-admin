import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Phase 0/1 placeholder — proves the design system + auth round-trip.
 * Will be replaced in Phase 8 by the real dashboard.
 */
export default async function Home() {
  const session = await requireSession();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-12 px-8 py-16">
      <header className="flex items-end justify-between gap-6 border-b border-border pb-6">
        <div className="space-y-3">
          <h1 className="font-sans text-5xl font-medium tracking-tight">
            Retrospectiva{" "}
            <span className="text-brand-terracotta">Admin</span>
          </h1>
          <p className="max-w-xl text-brand-olive-deep/80">
            Signed in as{" "}
            <span className="font-medium text-foreground">{session.username}</span>
            . Vintage clothing, second-hand stories — the admin panel is
            being wired up.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="font-mono uppercase tracking-widest">
            v0.1 · dev
          </Badge>
          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Login (preview)</CardTitle>
            <CardDescription>
              Brand inputs, terracotta focus, olive secondary.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-caplet">
                Username
              </Label>
              <Input id="username" placeholder="your username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-caplet">
                Password
              </Label>
              <Input id="password" type="password" placeholder="••••••••" />
            </div>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button>Sign in</Button>
            <Button variant="secondary">Reset</Button>
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}
