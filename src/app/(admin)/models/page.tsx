import { desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { ModelsTable } from "@/components/models/models-table";
import { ModelsTabs } from "@/components/models/models-tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { aiModels, type AiModelStatus } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";

const TABS: Array<AiModelStatus> = ["active", "draft", "archived"];

function parseTab(raw: string | string[] | undefined): AiModelStatus {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return TABS.includes(v as AiModelStatus) ? (v as AiModelStatus) : "active";
}

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const sp = await searchParams;
  const tab = parseTab(sp.tab);

  const rows = await db
    .select({
      id: aiModels.id,
      label: aiModels.label,
      status: aiModels.status,
      ageRange: aiModels.ageRange,
      bodyType: aiModels.bodyType,
      hairColor: aiModels.hairColor,
      hairShape: aiModels.hairShape,
      hairType: aiModels.hairType,
      contactSheetKey: aiModels.contactSheetKey,
      cropsAvailable: aiModels.cropsAvailable,
      frontPortraitKey: aiModels.frontPortraitKey,
      createdAt: aiModels.createdAt,
    })
    .from(aiModels)
    .where(eq(aiModels.status, tab))
    .orderBy(desc(aiModels.createdAt));

  return (
    <>
      <PageHeader>
        <PageHeader.Column className="flex-1 flex-col">
          <PageHeader.Eyebrow number="03" label={m.models.kicker} />
          <PageHeader.Title>{m.models.pageTitle}</PageHeader.Title>
          <PageHeader.Description>
            {m.models.pageDescription}
          </PageHeader.Description>
        </PageHeader.Column>
        <PageHeader.Column className="self-end content-end">
          <Button asChild>
            <Link href="/models/new" className="gap-1.5">
              <Plus className="size-4" />
              {m.models.newModelCta}
            </Link>
          </Button>
        </PageHeader.Column>
      </PageHeader>

      <ModelsTabs currentTab={tab} />

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{m.models.emptyState.title}</CardTitle>
            <CardDescription>{m.models.emptyState.body}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/models/new" className="gap-1.5">
                <Plus className="size-4" />
                {m.models.emptyState.cta}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ModelsTable rows={rows} />
      )}
    </>
  );
}
