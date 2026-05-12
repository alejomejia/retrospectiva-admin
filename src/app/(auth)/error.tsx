"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { devError } from "@/lib/utils/dev";

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Error boundary for the `(auth)` group (currently just /login). Keeps
 * the brand wordmark + paper background from the auth layout above it
 * so the failure still feels like part of the admin, not a system
 * crash.
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    devError("auth route error:", error);
  }, [error]);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" />
          Sign-in unavailable
        </CardTitle>
        <CardDescription>
          {IS_DEV
            ? error.message
            : "Please try again in a moment. If this persists, contact the admin."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">
            digest: {error.digest}
          </p>
        ) : null}
        <Button onClick={() => reset()} className="w-full">
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
