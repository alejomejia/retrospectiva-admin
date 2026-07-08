"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { verifyPassword } from "@/lib/auth/password";
import { checkRate, resetRate } from "@/lib/auth/rate-limit";
import { setSessionCookie, signSession } from "@/lib/auth/session";
import { findUser } from "@/lib/auth/users";
import { m } from "@/lib/i18n/messages.en";
import { devGroup } from "@/lib/utils/dev";
const dev = devGroup("auth");

const Schema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
  next: z.string().optional(),
});

export type SignInState = { error?: string };

/**
 * Login server action. Consumed by `useActionState` in the login form.
 *
 * On success → `redirect()` (Next throws the redirect, so the action
 * never returns to the client). On failure → returns `{ error }` so the
 * form can render the message inline.
 *
 * Step order matters: rate-limit check happens before bcrypt verify so a
 * locked-out client doesn't drive the CPU. We still call verifyPassword
 * against a dummy hash for unknown usernames so attackers can't time-
 * detect which usernames exist.
 */
export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = Schema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    dev.warn("zod validation failed:", parsed.error.issues);
    return { error: m.errors.invalidForm };
  }
  const { username, password, next } = parsed.data;

  const ip = await readClientIp();
  const rateKey = `${ip}|${username}`;
  const rate = checkRate(rateKey);
  if (!rate.allowed) {
    dev.warn(`rate-limited: ${rateKey} for ${rate.retryAfterSec}s`);
    return { error: m.errors.tooManyAttempts(rate.retryAfterSec) };
  }

  let user;
  try {
    user = findUser(username);
  } catch (err) {
    // Almost always means ALLOW_USERS is malformed (e.g. you pasted a
    // raw bcrypt hash whose `$VAR` runs got eaten by dotenv). The
    // dev-facing detail (parser message) stays English; the user-facing
    // prefix is Spanish so the main user at least understands the surface.
    dev.error("findUser threw — likely ALLOW_USERS misconfig:", err);
    const detail = err instanceof Error ? err.message : "unknown error";
    return { error: m.errors.authMisconfigured(detail) };
  }
  if (!user) {
    // NOTE: dummy bcrypt compare keeps timing constant regardless of
    // whether the username exists. Hash is a throwaway, never matches.
    await verifyPassword(password, "$2b$12$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPq");
    dev.warn(`user not found: ${username}`);
    return { error: m.errors.invalidCredentials };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    dev.warn(`password mismatch for: ${username}`);
    return { error: m.errors.invalidCredentials };
  }

  resetRate(rateKey);
  const token = await signSession(user.username);
  await setSessionCookie(token);
  dev.log(`signed in: ${username} → ${next ?? "/"}`);

  // Only honor relative paths so an attacker can't redirect off-site.
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(target);
}

async function readClientIp(): Promise<string> {
  const h = await headers();
  // x-forwarded-for is set by the reverse proxy (Caddy/Nginx) on the VPS.
  // Falls back to a constant when missing so the rate key is still stable.
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
