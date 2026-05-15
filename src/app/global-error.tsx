"use client";

import { useEffect } from "react";

import { m } from "@/lib/i18n/messages.es";

/**
 * Root-level error boundary. Catches errors thrown inside `app/layout.tsx`
 * itself (font loading, etc.) — situations where the normal layout has
 * failed to render, so we can't rely on its fonts or Toaster.
 *
 * MUST include its own `<html>` and `<body>` because it REPLACES the
 * root layout when it triggers. Styling stays inline / minimal for the
 * same reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Can't import devError here because root may be broken — keep deps
    // minimal so this boundary is always renderable.
    console.error("global error:", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          background: "#f7f3e7",
          color: "#2a2a25",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 500, marginBottom: "0.75rem" }}>
            {m.globalError.title}
          </h1>
          <p style={{ color: "#3f4530", marginBottom: "1.5rem" }}>
            {m.globalError.body}
          </p>
          {error.digest ? (
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "#7a7e5f" }}>
              {m.globalError.digestPrefix} {error.digest}
            </p>
          ) : null}
          <button
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.25rem",
              borderRadius: "9999px",
              border: 0,
              background: "#a6461b",
              color: "#f7f3e7",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            {m.globalError.tryAgain}
          </button>
        </div>
      </body>
    </html>
  );
}
