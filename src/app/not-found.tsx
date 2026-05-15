import Link from "next/link";

import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.es";

/**
 * Default 404 for unmatched URLs and any unhandled `notFound()` call.
 * Renders inside the root layout (brand-paper background, DM Sans),
 * not inside the (admin) layout — so it shows even when the user isn't
 * signed in.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="text-caplet">{m.notFound.label}</p>
      <h1 className="font-sans text-5xl font-medium tracking-tight">
        {m.notFound.title}
      </h1>
      <p className="text-brand-olive-deep/80">{m.notFound.body}</p>
      <Button asChild>
        <Link href="/">{m.notFound.cta}</Link>
      </Button>
    </div>
  );
}
