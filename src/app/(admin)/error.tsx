"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { m } from "@/lib/i18n/messages.es";
import { devError } from "@/lib/utils/dev";

/**
 * Error boundary for everything under `(admin)`. Next bubbles uncaught
 * errors thrown in a server component or server action up to the
 * nearest `error.tsx`. Because the boundary sits inside the (admin)
 * layout, the sidebar and topbar stay visible — only `<main>` swaps to
 * this card, so the user can still navigate away.
 *
 * NOTE: must be a client component (it uses `reset()` and `useEffect`).
 */

// process.env.NODE_ENV is inlined by Next at build time, so the dev
// branch is dead-code-eliminated in production bundles.
const IS_DEV = process.env.NODE_ENV === "development";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    devError("admin route error:", error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" />
          {m.errorBoundary.title}
        </CardTitle>
        <CardDescription className="space-y-2">
          <span className="block">
            {IS_DEV ? error.message : m.errorBoundary.bodyProd}
          </span>
          {error.digest ? (
            <span className="block font-mono text-xs text-muted-foreground">
              {m.errorBoundary.digestPrefix} {error.digest}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardFooter className="gap-2">
        <Button onClick={() => reset()}>{m.errorBoundary.tryAgain}</Button>
        <Button variant="ghost" onClick={() => router.push("/")}>
          {m.errorBoundary.backToDashboard}
        </Button>
      </CardFooter>
    </Card>
  );
}
