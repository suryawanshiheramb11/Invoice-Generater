"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

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
      show(err instanceof Error ? err.message : "Sign up failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          We sent a confirmation link to <strong>{email}</strong>. Confirm your email to finish creating your account.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
        </CardHeader>
        <CardContent>
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
            <Button type="submit" className="w-full" loading={loading}>
              <UserPlus className="h-3.5 w-3.5" /> Sign Up
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
