import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { NewModelForm } from "@/components/models/new-model-form";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/require-session";
import { m } from "@/lib/i18n/messages.es";

export default async function NewModelPage() {
  await requireSession();
  return (
    <>
      <PageHeader>
        <PageHeader.Column className="flex-1 flex-col">
          <PageHeader.Back href="/models" label={m.models.detail.backToList} />
          <PageHeader.Title>{m.models.new.title}</PageHeader.Title>
          <PageHeader.Description>
            {m.models.new.description}
          </PageHeader.Description>
        </PageHeader.Column>
        <PageHeader.Column className="self-end content-end">
          <Button asChild variant="ghost">
            <Link href="/models">{m.models.new.cancel}</Link>
          </Button>
        </PageHeader.Column>
      </PageHeader>

      <NewModelForm />
    </>
  );
}
