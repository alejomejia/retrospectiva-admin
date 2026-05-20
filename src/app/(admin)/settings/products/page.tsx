import { AiImageToggleForm } from "@/components/forms/ai-image-toggle-form";
import { BuyPriceDefaultsForm } from "@/components/forms/buy-price-defaults-form";
import { ShopMarkupForm } from "@/components/forms/shop-markup-form";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db/client";
import { etsyOauth } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { getAllBuyPriceDefaults } from "@/lib/products/buy-price-defaults";
import { DEFAULT_MARKUP_PERCENT } from "@/lib/products/pricing";
import { getProductSettings } from "@/lib/products/settings";

export default async function ProductSettingsPage() {
  const [rows, buyPriceDefaults, settings] = await Promise.all([
    db.select().from(etsyOauth).limit(1),
    getAllBuyPriceDefaults(),
    getProductSettings(),
  ]);
  const currentMarkupPercent = rows[0]?.markupPercent ?? DEFAULT_MARKUP_PERCENT;

  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeader.Column className="flex-1 flex-col">
          <PageHeader.Eyebrow number="04" label={m.settings.products.kicker} />
          <PageHeader.Title>{m.settings.products.title}</PageHeader.Title>
          <PageHeader.Description>
            {m.settings.products.description}
          </PageHeader.Description>
        </PageHeader.Column>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>{m.settings.products.markupCardTitle}</CardTitle>
          <CardDescription>
            {m.settings.products.markupCardDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShopMarkupForm currentMarkupPercent={currentMarkupPercent} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{m.settings.products.aiImage.cardTitle}</CardTitle>
          <CardDescription>
            {m.settings.products.aiImage.cardDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AiImageToggleForm
            currentAiImageEnabled={settings.aiImageEnabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{m.settings.products.buyPrice.cardTitle}</CardTitle>
          <CardDescription>
            {m.settings.products.buyPrice.cardDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BuyPriceDefaultsForm defaults={buyPriceDefaults} />
        </CardContent>
      </Card>
    </div>
  );
}
