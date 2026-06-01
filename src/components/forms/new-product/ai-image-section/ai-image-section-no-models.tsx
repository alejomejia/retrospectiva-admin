import { UserPlus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.es";

export function NoModelsEmptyState() {
  const t = m.products.stepper.step1.aiImageSection;
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-dashed bg-card/40 p-6">
      <div className="flex items-center gap-2 text-caplet">
        <UserPlus className="size-4" />
        {t.modelEmptyTitle}
      </div>
      <p className="text-sm text-muted-foreground">{t.modelEmptyBody}</p>
      <Button asChild size="sm" variant="secondary">
        <Link href="/models/new">
          <UserPlus className="size-4" />
          {t.modelEmptyCta}
        </Link>
      </Button>
    </div>
  );
}
