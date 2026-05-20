import { AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";

import { EtsyDefaultsForm } from "@/components/forms/etsy-defaults-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db/client";
import { etsyOauth } from "@/lib/db/schema";
import { etsyFetch } from "@/lib/integrations/etsy/client";
import {
  listReturnPolicies,
  listShippingProfiles,
  type ReturnPolicy,
  type ShippingProfile,
} from "@/lib/integrations/etsy/shop-config";
import { m } from "@/lib/i18n/messages.es";
import { devError } from "@/lib/utils/dev";

type SearchParams = {
  error?: string;
  connected?: string;
};

type ShopInfo = {
  shop_name: string;
};

type DefaultsData = {
  shippingProfiles: ShippingProfile[];
  returnPolicies: ReturnPolicy[];
  failed: boolean;
};

async function loadShopInfo(shopId: number): Promise<ShopInfo | null> {
  try {
    const res = await etsyFetch(`/shops/${shopId}`);
    if (!res.ok) {
      devError("settings/integrations: /shops fetch", res.status);
      return null;
    }
    return (await res.json()) as ShopInfo;
  } catch (err) {
    devError("settings/integrations: /shops threw", err);
    return null;
  }
}

async function loadDefaultsData(shopId: number): Promise<DefaultsData> {
  try {
    const [shippingProfiles, returnPolicies] = await Promise.all([
      listShippingProfiles(shopId),
      listReturnPolicies(shopId),
    ]);
    return { shippingProfiles, returnPolicies, failed: false };
  } catch (err) {
    devError("settings/integrations: defaults fetch threw", err);
    return { shippingProfiles: [], returnPolicies: [], failed: true };
  }
}

function errorMessage(code: string): string | null {
  const map = m.settings.etsy.errors as Record<string, string>;
  return map[code] ?? null;
}

export default async function IntegrationsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const errorMsg = sp.error ? errorMessage(sp.error) : null;

  const rows = await db.select().from(etsyOauth).limit(1);
  const connection = rows[0] ?? null;

  const [shopInfo, defaults] = connection
    ? await Promise.all([
        loadShopInfo(Number(connection.shopId)),
        loadDefaultsData(Number(connection.shopId)),
      ])
    : [null, null];

  return (
    <div className="space-y-6">
      <PageHeader>
      <PageHeader.Column className="flex-1 flex-col">
          <PageHeader.Eyebrow number="04" label={m.settings.integrations.kicker} />
          <PageHeader.Title>{m.settings.integrations.title}</PageHeader.Title>
          <PageHeader.Description>
            {m.settings.integrations.description}
          </PageHeader.Description>
        </PageHeader.Column>
      </PageHeader>

      <section className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold">{m.settings.etsy.title}</h2>
          <p className="text-sm text-muted-foreground">
            {m.settings.etsy.description}
          </p>
        </header>

        {errorMsg && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <AlertCircle className="mt-0.5 size-5 text-destructive" />
              <div className="space-y-1">
                <CardTitle className="text-base">
                  {m.settings.etsy.fetchShopErrorTitle}
                </CardTitle>
                <CardDescription>{errorMsg}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}

        {connection ? (
          <>
            <ConnectedCard
              shopId={Number(connection.shopId)}
              shopInfo={shopInfo}
            />
            <DefaultsCard
              data={defaults!}
              currentShippingProfileId={connection.defaultShippingProfileId}
              currentReturnPolicyId={connection.defaultReturnPolicyId}
            />
          </>
        ) : (
          <DisconnectedCard />
        )}
      </section>
    </div>
  );
}

function DisconnectedCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.settings.etsy.disconnectedTitle}</CardTitle>
        <CardDescription>{m.settings.etsy.disconnectedBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <a href="/api/etsy/oauth/start">
            <ExternalLink className="mr-2 size-4" />
            {m.settings.etsy.connectButton}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function ConnectedCard({
  shopId,
  shopInfo,
}: {
  shopId: number;
  shopInfo: ShopInfo | null;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <CheckCircle2 className="mt-0.5 size-5 text-brand-olive" />
        <div className="space-y-1">
          <CardTitle>{m.settings.etsy.connectedTitle}</CardTitle>
          <CardDescription>
            {shopInfo
              ? m.settings.etsy.connectedAs(shopInfo.shop_name)
              : m.settings.etsy.fetchShopErrorBody}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          {m.settings.etsy.shopIdLabel(shopId)}
        </p>
        <p className="text-muted-foreground">
          {m.settings.etsy.expiresLabel}
        </p>
        <Button asChild variant="outline" size="sm">
          <a href="/api/etsy/oauth/start">
            {m.settings.etsy.reconnectButton}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function DefaultsCard({
  data,
  currentShippingProfileId,
  currentReturnPolicyId,
}: {
  data: DefaultsData;
  currentShippingProfileId: number | null;
  currentReturnPolicyId: number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.settings.etsy.defaults.title}</CardTitle>
        <CardDescription>
          {m.settings.etsy.defaults.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.failed && (
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-sm font-medium">
              {m.settings.etsy.defaults.unavailableTitle}
            </p>
            <p className="text-sm text-muted-foreground">
              {m.settings.etsy.defaults.unavailableBody}
            </p>
          </div>
        )}
        {!data.failed && (
          <EtsyDefaultsForm
            shippingProfiles={data.shippingProfiles}
            returnPolicies={data.returnPolicies}
            currentShippingProfileId={currentShippingProfileId}
            currentReturnPolicyId={currentReturnPolicyId}
          />
        )}
      </CardContent>
    </Card>
  );
}
