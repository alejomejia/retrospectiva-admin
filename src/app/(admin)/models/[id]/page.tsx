import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import {
  ModelDetailView,
  STATUS_VARIANT,
  type ModelImageUrls,
} from "@/components/models/model-detail-view";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { aiModels, type AiModel } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { R2_PUBLIC_BASE_URL } from "@/lib/integrations/r2/client";
import { publicUrlFor } from "@/lib/integrations/r2/keys";
import { Badge } from "@/components/ui/badge";

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const [model] = await db
    .select()
    .from(aiModels)
    .where(eq(aiModels.id, id))
    .limit(1);

  if (!model) notFound();

  const urls = buildImageUrls(model);

  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeader.Column className="flex-1 flex-col">
          <PageHeader.Back href="/models" label={m.models.detail.backToList} />
          <div className="flex items-center gap-4">
            <PageHeader.Title>{model.label ?? m.models.detail.contactSheetAlt}</PageHeader.Title>
            <Badge variant={STATUS_VARIANT[model.status]}>
              {m.models.statuses[model.status]}
            </Badge>
          </div>
          <PageHeader.Description>
            {m.models.new.description}
          </PageHeader.Description>
        </PageHeader.Column>
      </PageHeader>
      <ModelDetailView model={model} urls={urls} />
    </div>
  );
}

function buildImageUrls(model: AiModel): ModelImageUrls {
  const resolve = (key: string | null) =>
    key ? publicUrlFor(key, R2_PUBLIC_BASE_URL) : null;
  return {
    contactSheet: resolve(model.contactSheetKey),
    panels: {
      front_full: resolve(model.frontFullKey),
      front_portrait: resolve(model.frontPortraitKey),
      front_editorial: resolve(model.frontEditorialKey),
      side_portrait: resolve(model.sidePortraitKey),
      back_full: resolve(model.backFullKey),
      threequarter_full: resolve(model.threequarterFullKey),
    },
  };
}
