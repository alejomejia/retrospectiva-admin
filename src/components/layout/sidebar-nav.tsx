"use client";

import { LayoutDashboard, Package, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { m } from "@/lib/i18n/messages.es";
import { cn } from "@/lib/utils/helpers";

/**
 * Sidebar nav for the (admin) section. Hand-rolled rather than using
 * shadcn's full Sidebar primitive — the structure stays small. Upgrade
 * if/when nav grows further.
 */

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { href: string; label: string }[];
};

const topItems: NavItem[] = [
  { href: "/", label: m.nav.dashboard, icon: LayoutDashboard },
  { href: "/products", label: m.nav.products, icon: Package },
  { href: "/models", label: m.nav.models, icon: Users },
];

const settingsGroup: NavGroup = {
  label: m.nav.settings,
  icon: Settings,
  items: [
    { href: "/settings/products", label: m.nav.settingsProducts },
    { href: "/settings/integrations", label: m.nav.settingsIntegrations },
  ],
};

export function SidebarNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  const SettingsIcon = settingsGroup.icon;

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 p-3">
      {topItems.map((item) => {
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

      <div className="flex items-center gap-3 px-3 py-2 text-sm tracking-wide text-foreground/70">
        <SettingsIcon className="size-4" />
        {settingsGroup.label}
      </div>
      {settingsGroup.items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "ml-7 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-brand-terracotta/10 text-brand-terracotta font-medium"
                : "text-foreground/70 hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
