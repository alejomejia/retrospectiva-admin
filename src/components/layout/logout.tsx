import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.en";

/**
 * Logout for the (admin) section. 
 * Sign-out button that POSTs to /api/auth/logout. 
 * The logout route clears the cookie and 303-redirects to /login.
 */
export function Logout() {
  return (
    <header className="flex flex-col items-center justify-center gap-2 h-16 p-3 border-t border-border/50">
      <form className="w-full" action="/api/auth/logout" method="post">
        <Button type="submit" variant="ghost" size="sm" className="w-full gap-2">
          <LogOut className="size-4" />
          {m.common.signOut}
        </Button>
      </form>
    </header>
  );
}
