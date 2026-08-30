"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Card, CardContent } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { friendlyErrorMessage } from "@/lib/errors";

export default function ForgotPasswordPage() {
  const { show } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-center sm:py-24">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-soft text-2xl">✉️</span>
        <h1 className="mt-6 font-display text-2xl font-extrabold text-foreground">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          If an account exists for <strong className="text-foreground">{email}</strong>, we sent a password reset
          link.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:py-24">
      <span className="mx-auto flex h-[70px] w-[70px] -rotate-6 items-center justify-center rounded-3xl bg-sun text-2xl">🔑</span>
      <h1 className="mt-6 text-center font-display text-3xl font-extrabold tracking-tight text-foreground">
        Reset your password
      </h1>
      <p className="mt-2 text-center text-sm text-muted">Pop in your email and we&apos;ll send a link.</p>

      <Card className="mt-8">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" required>
              <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              <Mail className="h-4 w-4" /> Send Reset Link
            </Button>
          </form>
          <p className="mt-5 text-center text-sm font-bold">
            <Link href="/login" className="text-accent hover:text-accent-hover">
              Back to login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
