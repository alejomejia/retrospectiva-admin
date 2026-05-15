"use client";

import { LayoutDashboard, Package, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { m } from "@/lib/i18n/messages.es";
import { cn } from "@/lib/utils/helpers";

/**
 * Sidebar nav for the (admin) section. Hand-rolled rather than using
 * shadcn's full Sidebar primitive — for 3 nav items the compound
 * component is more weight than it's worth. Upgrade if/when nav grows.
 */

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const items: NavItem[] = [
  { href: "/", label: m.nav.dashboard, icon: LayoutDashboard },
  { href: "/products", label: m.nav.products, icon: Package },
  { href: "/settings/etsy", label: m.nav.settings, icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 p-3">
      {items.map((item) => {
        // Exact match on /, prefix match elsewhere so /products/new still
        // highlights the Products item.
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
  );
}
