"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation';
import { Box, Sparkles, Wrench } from 'lucide-react';

import { m } from "@/lib/i18n/messages.es";
import { cn } from "@/lib/utils/helpers";

export type NavGroup = {
  href: string; 
  label: string, 
  icon: React.ComponentType<{ className?: string }> 
}

const settingsGroup: NavGroup[] = [
  {
    href: "/settings/products",
    label: m.nav.settingsProducts,
    icon: Box
  },
  {
    href: "/settings/ai",
    label: m.nav.settingsAi,
    icon: Sparkles
  },
  {
    href: "/settings/integrations",
    label: m.nav.settingsIntegrations,
    icon: Wrench
  },
]

export function SidebarSettings () {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
        {settingsGroup.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
            <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                    ? "bg-brand-terracotta/10 text-brand-terracotta font-medium"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground",
                )}
            >
                <Icon className="size-4" />
                {item.label}
            </Link>
            );
        })}
      </nav>
    </aside>
  )
}