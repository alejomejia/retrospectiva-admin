import { Sparkles, Tag, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { requireSession } from "@/lib/auth/require-session";
import { m } from "@/lib/i18n/messages.es";
import {
  STORY_VARIANTS,
  type StoryVariantKey,
} from "@/lib/products/instagram-story-variants";

// One icon per template; adding a variant key forces a choice here (and an
// i18n label under `socials.landing.<key>`), so a new template surfaces as a
// landing card automatically.
const VARIANT_ICON: Record<StoryVariantKey, LucideIcon> = {
  new: Sparkles,
  sold: Tag,
};

/**
 * Socials landing: pick which kind of post to generate. Each card opens the
 * matching variant page (`/socials/new`, `/socials/sold`) where a product is
 * searched/selected before the studio appears.
 */
export default async function SocialsPage() {
  await requireSession();

  return (
    <>
      <PageHeader>
        <PageHeader.Column className="flex-1 flex-col">
          <PageHeader.Eyebrow number="04" label={m.socials.eyebrow} />
          <PageHeader.Title>{m.socials.pageTitle}</PageHeader.Title>
          <PageHeader.Description>
            {m.socials.landing.description}
          </PageHeader.Description>
        </PageHeader.Column>
      </PageHeader>

      <main className="p-6">
        <ul className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
          {STORY_VARIANTS.map(({ key }) => {
            const Icon = VARIANT_ICON[key];
            return (
            <li key={key}>
              <Link
                href={`/socials/${key}`}
                className="group flex flex-col gap-3 rounded-lg border border-border bg-brand-cream p-6 transition-colors hover:border-brand-terracotta"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-brand-ink/5 text-brand-terracotta">
                  <Icon className="size-5" />
                </span>
                <span className="text-base text-foreground">
                  {m.socials.landing[key].title}
                </span>
                <span className="text-sm text-muted-foreground">
                  {m.socials.landing[key].description}
                </span>
              </Link>
            </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
