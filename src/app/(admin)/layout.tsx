import Link from "next/link";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { requireSession } from "@/lib/auth/require-session";

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
  const session = await requireSession();

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
        <Link
          href="/"
          className="flex h-14 items-center border-b border-border px-4 font-medium tracking-tight"
        >
          Retrospectiva{" "}
          <span className="ml-1 text-brand-terracotta">Admin</span>
        </Link>
        <SidebarNav />
      </aside>
      <div className="flex flex-1 flex-col">
        <Topbar username={session.username} />
        <main className="flex-1 px-6 py-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}
