import { AiDefaultsForm } from "@/components/forms/ai-defaults-form";
import { PageHeader } from "@/components/layout/page-header";
import { SidebarSettings } from "@/components/layout/sidebar-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listActiveAiModels } from "@/lib/ai-models/actions";
import { m } from "@/lib/i18n/messages.es";
import { getProductSettings } from "@/lib/products/settings";

export default async function AiSettingsPage() {
  const [settings, models] = await Promise.all([
    getProductSettings(),
    listActiveAiModels(),
  ]);

  return (
    <>
      <PageHeader>
        <PageHeader.Column className="flex-1 flex-col">
          <PageHeader.Eyebrow number="05" label={m.settings.ai.kicker} />
          <PageHeader.Title>{m.settings.ai.title}</PageHeader.Title>
          <PageHeader.Description>
            {m.settings.ai.description}
          </PageHeader.Description>
        </PageHeader.Column>
      </PageHeader>

      <main className="p-6">
        <div className="flex gap-4">
          <div className="w-96">
            <SidebarSettings />
          </div>
          <div className="w-full space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{m.settings.ai.cardTitle}</CardTitle>
                <CardDescription>{m.settings.ai.cardDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <AiDefaultsForm
                  initial={{
                    aiDefaultModelId: settings.aiDefaultModelId,
                    aiDefaultSourcePanel: settings.aiDefaultSourcePanel,
                    aiDefaultPosePreset: settings.aiDefaultPosePreset,
                    aiDefaultFramingPreset: settings.aiDefaultFramingPreset,
                    aiDefaultEnvironmentPreset:
                      settings.aiDefaultEnvironmentPreset,
                    aiDefaultImageQuality: settings.aiDefaultImageQuality,
                  }}
                  models={models}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
