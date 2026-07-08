import Link from "next/link";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Logo } from "@/components/ui/logo";
import { Logout } from "@/components/layout/logout";
import { Badge } from "@/components/ui/badge";
import { config, isProd } from "@/lib/utils/config";

// NOTE: Every admin route is auth-gated and DB-backed — never prerender at
// build time, where Postgres/Redis are unreachable. Forcing dynamic here
// covers all current and future segments under (admin).
export const dynamic = "force-dynamic";

/**
 * Shared layout for every authenticated screen. Sidebar holds the
 * primary nav; topbar shows the active username + sign-out.
 *
 * `requireSession()` here is a defense-in-depth — `proxy.ts` already
 * gates these routes, but if a misconfigured cookie ever slips through,
 * the layout still redirects to /login before anything renders.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="fixed top-0 left-0 bottom-0 hidden w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
        <Link
          href="/"
          className="flex py-4 items-center border-b border-border/50 px-4 font-medium tracking-tight"
        >
          <Logo />
        </Link>
        <SidebarNav />
        <div className="flex items-center justify-center py-3">
          <Badge variant="secondary" className="font-mono text-xs uppercase tracking-widest">
              v0.3 · {isProd ? "prod" : "dev"}
          </Badge>
        </div>
        <Logout />
      </aside>
      <div className="w-full ml-56 min-h-screen">
        {children}
      </div>
    </div>
  );
}
