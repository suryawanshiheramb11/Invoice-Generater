"use client";

import { Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Card, CardContent } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { safeRedirectPath } from "@/lib/redirect";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { show } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "auth_callback_failed") {
      show("Google sign-in failed. Please try again.", "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      show("Welcome back!", "success");
      router.push(safeRedirectPath(searchParams.get("redirect")));
      router.refresh();
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:py-24">
      <h1 className="text-center font-display text-3xl font-extrabold tracking-tight text-foreground">Welcome back</h1>
      <p className="mt-2 text-center text-sm text-muted">Your drafts are exactly where you left them.</p>

      <Card className="mt-8">
        <CardContent className="p-6">
          <GoogleSignInButton redirectTo={safeRedirectPath(searchParams.get("redirect"))} />

          <div className="my-5 flex items-center gap-3 text-xs font-semibold text-muted-soft">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" required>
              <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" required>
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <div className="text-right">
              <Link href="/forgot-password" className="text-xs font-bold text-accent hover:text-accent-hover">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              <LogIn className="h-4 w-4" /> Log In
            </Button>
          </form>
          <p className="mt-5 text-center text-sm font-medium text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-bold text-accent hover:text-accent-hover">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
