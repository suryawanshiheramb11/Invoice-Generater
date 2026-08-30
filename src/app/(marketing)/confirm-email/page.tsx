"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/Card";

/**
 * Supabase's default "Confirm signup" email redirects here with the session
 * in the URL hash fragment (not a `?code=`), which only client-side JS can
 * read — so this has to be a client page rather than a route handler. Same
 * pattern as reset-password: wait for the browser client to pick up the
 * session from the hash, then move on.
 */
export default function ConfirmEmailPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    function finish() {
      if (settled) return;
      settled = true;
      router.replace("/dashboard");
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") finish();
    });

    const timeout = setTimeout(() => {
      if (!settled) setFailed(true);
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-sm px-4 py-16 sm:py-24">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          {failed ? (
            <>
              <p className="text-sm font-medium text-muted">Couldn&apos;t confirm your email automatically.</p>
              <Link href="/login" className="text-sm font-bold text-accent hover:text-accent-hover">
                Go to login
              </Link>
            </>
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <p className="text-sm font-medium text-muted">Confirming your email…</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
