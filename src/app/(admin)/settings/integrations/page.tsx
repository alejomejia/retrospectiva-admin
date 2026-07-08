import { AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";

import {
  EtsyReadinessStateForm,
  EtsyReturnPolicyForm,
  EtsyShippingMappingForm,
} from "@/components/forms/etsy-defaults-form";
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
  listReadinessStates,
  listReturnPolicies,
  listShippingProfiles,
  type ReadinessStateDefinition,
  type ReturnPolicy,
  type ShippingProfile,
} from "@/lib/integrations/etsy/shop-config";
import { m } from "@/lib/i18n/messages.en";
import { devError } from "@/lib/utils/dev";
import { SidebarSettings } from "@/components/layout/sidebar-settings";

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
  readinessStates: ReadinessStateDefinition[];
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
    const [shippingProfiles, returnPolicies, readinessStates] = await Promise.all([
      listShippingProfiles(shopId),
      listReturnPolicies(shopId),
      listReadinessStates(shopId),
    ]);
    return {
      shippingProfiles,
      returnPolicies,
      readinessStates,
      failed: false,
    };
  } catch (err) {
    devError("settings/integrations: defaults fetch threw", err);
    return {
      shippingProfiles: [],
      returnPolicies: [],
      readinessStates: [],
      failed: true,
    };
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
    <>
      <PageHeader>
      <PageHeader.Column className="flex-1 flex-col">
          <PageHeader.Eyebrow number="04" label={m.settings.integrations.kicker} />
          <PageHeader.Title>{m.settings.integrations.title}</PageHeader.Title>
          <PageHeader.Description>
            {m.settings.integrations.description}
          </PageHeader.Description>
        </PageHeader.Column>
      </PageHeader>

      <main className="p-6">
        <div className="flex gap-4">
          <div className="w-96">
            <SidebarSettings />
          </div>
          <div className="w-full space-y-4">

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
              <ShippingMappingCard
                data={defaults!}
                currentShippingProfileLightId={connection.shippingProfileLightId}
                currentShippingProfileMediumId={connection.shippingProfileMediumId}
                currentShippingProfileHeavyId={connection.shippingProfileHeavyId}
              />
              <ReturnPolicyCard
                data={defaults!}
                currentReturnPolicyId={connection.defaultReturnPolicyId}
              />
              <ReadinessStateCard
                data={defaults!}
                currentReadinessStateId={connection.defaultReadinessStateId}
              />
            </>
          ) : (
            <DisconnectedCard />
          )}
          </div>
        </div>
      </main>
    </>
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
        <div className="space-y-1">
          <CardTitle>{m.settings.etsy.title}</CardTitle>
          <CardDescription>{m.settings.etsy.description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex gap-2 items-center">
          <CheckCircle2 className="mt-0.5 size-5 text-brand-olive" />
          <span>{m.settings.etsy.connectedTitle} -</span>
          <span>
            {shopInfo
              ? m.settings.etsy.connectedAs(shopInfo.shop_name)
              : m.settings.etsy.fetchShopErrorBody} -
          </span>
          <span>{m.settings.etsy.shopIdLabel(shopId)}</span>
        </div>
        
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

function ShippingMappingCard({
  data,
  currentShippingProfileLightId,
  currentShippingProfileMediumId,
  currentShippingProfileHeavyId,
}: {
  data: DefaultsData;
  currentShippingProfileLightId: number | null;
  currentShippingProfileMediumId: number | null;
  currentShippingProfileHeavyId: number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.settings.etsy.defaults.shippingMappingTitle}</CardTitle>
        <CardDescription>
          {m.settings.etsy.defaults.shippingMappingDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.failed ? (
          <UnavailableNotice />
        ) : (
          <EtsyShippingMappingForm
            shippingProfiles={data.shippingProfiles}
            currentShippingProfileLightId={currentShippingProfileLightId}
            currentShippingProfileMediumId={currentShippingProfileMediumId}
            currentShippingProfileHeavyId={currentShippingProfileHeavyId}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ReturnPolicyCard({
  data,
  currentReturnPolicyId,
}: {
  data: DefaultsData;
  currentReturnPolicyId: number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.settings.etsy.defaults.returnPolicyTitle}</CardTitle>
        <CardDescription>
          {m.settings.etsy.defaults.returnPolicyDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.failed ? (
          <UnavailableNotice />
        ) : (
          <EtsyReturnPolicyForm
            returnPolicies={data.returnPolicies}
            currentReturnPolicyId={currentReturnPolicyId}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ReadinessStateCard({
  data,
  currentReadinessStateId,
}: {
  data: DefaultsData;
  currentReadinessStateId: number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.settings.etsy.defaults.readinessStateTitle}</CardTitle>
        <CardDescription>
          {m.settings.etsy.defaults.readinessStateDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.failed ? (
          <UnavailableNotice />
        ) : (
          <EtsyReadinessStateForm
            readinessStates={data.readinessStates}
            currentReadinessStateId={currentReadinessStateId}
          />
        )}
      </CardContent>
    </Card>
  );
}

function UnavailableNotice() {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <p className="text-sm font-medium">
        {m.settings.etsy.defaults.unavailableTitle}
      </p>
      <p className="text-sm text-muted-foreground">
        {m.settings.etsy.defaults.unavailableBody}
      </p>
    </div>
  );
}
