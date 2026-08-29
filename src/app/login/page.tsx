"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { show } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      show("Welcome back!", "success");
      router.push(searchParams.get("redirect") || "/dashboard");
      router.refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : "Login failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Log in to your account</CardTitle>
        </CardHeader>
        <CardContent>
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
              <Link href="/forgot-password" className="text-xs text-accent hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" loading={loading}>
              <LogIn className="h-3.5 w-3.5" /> Log In
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-accent hover:underline">
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
