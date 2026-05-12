import { Badge } from "@/components/ui/badge";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

/**
 * Login page (server component). Wraps the client-side <LoginForm> in
 * Suspense so Next.js can statically prerender — useSearchParams inside
 * LoginForm requires it. The brand wordmark sits above the card so
 * signing in feels grounded in the same surface as the rest of the
 * admin (mirrors `app/page.tsx`).
 */
export default function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-8">
      <header className="flex items-end justify-between gap-6 border-b border-border pb-6">
        <div className="space-y-3 text-center">
          <h1 className="font-sans text-5xl font-medium tracking-tight">
            Retrospectiva{" "}
            <span className="text-brand-terracotta">Admin</span>
          </h1>
          <p className="max-w-xl text-brand-olive-deep/80">
            Vintage clothing, second-hand stories — the admin panel is
            being wired up.
          </p>
        </div>
      </header>
      <Suspense>
        <LoginForm />
      </Suspense>
      <div className="flex justify-end gap-3">
        <Badge variant="secondary" className="font-mono uppercase tracking-widest">
          v0.1 · dev
        </Badge>
      </div>
    </div>
  );
}
