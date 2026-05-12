import "server-only";
import { redirect } from "next/navigation";
import { getSessionCookie, verifySession } from "./session";

export type Session = { username: string };

/**
 * Server helper for use inside server components and server actions. If
 * the session cookie is missing or invalid, redirects to /login. Returns
 * the verified session otherwise.
 *
 * The primary gate is `proxy.ts` (runs before any route renders). This
 * helper is a defense-in-depth fallback for cases where the cookie was
 * somehow tampered between proxy and render, and a sanctioned way for
 * server components to access `username` without re-verifying.
 */
export async function requireSession(): Promise<Session> {
  const token = await getSessionCookie();
  if (!token) redirect("/login");
  const payload = await verifySession(token);
  if (!payload?.sub) redirect("/login");
  return { username: payload.sub };
}

/**
 * Non-throwing variant — returns `null` instead of redirecting. Use for
 * UI that conditionally renders based on auth state without forcing a
 * redirect (e.g. a topbar that shows "Sign out" only when signed in).
 */
export async function currentSession(): Promise<Session | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload?.sub) return null;
  return { username: payload.sub };
}
