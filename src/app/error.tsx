"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl font-extrabold text-foreground">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted">
        Your changes are safe — this page hit an unexpected error. Try again, or reload if it keeps happening.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
