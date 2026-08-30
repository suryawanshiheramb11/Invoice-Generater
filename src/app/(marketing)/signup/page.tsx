"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Card, CardContent } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default function SignupPage() {
  const { show } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      show("Password must be at least 8 characters.", "error");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      setDone(true);
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:py-24">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-soft text-2xl">✉️</span>
        <h1 className="mt-6 font-display text-2xl font-extrabold text-foreground">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          We sent a confirmation link to <strong className="text-foreground">{email}</strong>. Confirm your email to
          finish creating your account.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:py-24">
      <h1 className="text-center font-display text-3xl font-extrabold tracking-tight text-foreground">Let&apos;s set you up</h1>
      <p className="mt-2 text-center text-sm text-muted">Free forever for your first invoices.</p>

      <Card className="mt-8">
        <CardContent className="p-6">
          <GoogleSignInButton />

          <div className="my-5 flex items-center gap-3 text-xs font-semibold text-muted-soft">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" required>
              <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" required hint="At least 8 characters.">
              <Input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              <UserPlus className="h-4 w-4" /> Create account
            </Button>
          </form>
          <p className="mt-5 text-center text-sm font-medium text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-accent hover:text-accent-hover">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
