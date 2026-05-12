import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Top bar for the (admin) section. Shows the current username and a
 * sign-out button that POSTs to /api/auth/logout. The logout route
 * clears the cookie and 303-redirects to /login.
 */
export function Topbar({ username }: { username: string }) {
  return (
    <header className="flex h-14 items-center justify-end gap-4 border-b border-border bg-background/60 px-6 backdrop-blur-sm">
      <span className="text-caplet">
        {/* NOTE: username is non-secret (it's in the JWT sub claim).
            Showing it confirms the session is live. */}
        Signed in as <span className="text-foreground">{username}</span>
      </span>
      <form action="/api/auth/logout" method="post">
        <Button type="submit" variant="ghost" size="sm" className="gap-2">
          <LogOut className="size-4" />
          Sign out
        </Button>
      </form>
    </header>
  );
}
