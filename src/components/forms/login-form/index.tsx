"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { m } from "@/lib/i18n/messages.en";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = {};

export function LoginForm() {
  // NOTE: useSearchParams is wrapped in <Suspense> by the parent page;
  // without that, Next.js bails out of static prerender at build time.
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [state, action, pending] = useActionState(signIn, initialState);

  // useActionState returns a fresh state object on every submit, so this
  // effect fires once per failed attempt (even when the message is the
  // same as last time). Successful submits never reach here — the server
  // action calls `redirect()` and the page unmounts.
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{m.login.title}</CardTitle>
        <CardDescription>{m.login.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-5" noValidate>
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <Label htmlFor="username" className="text-caplet" required>
              {m.login.username}
            </Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-caplet" required>
              {m.login.password}
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full py-6 uppercase font-semibold tracking-widest" disabled={pending}>
            {pending ? m.common.signingIn : m.login.signInButton}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
