"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  /**
   * Makes every field inside read-only (used once an invoice has been sent). Applied as a
   * <fieldset disabled> around the body rather than to the section itself, so the
   * expand/collapse header keeps working — a locked invoice still needs to be readable.
   */
  disabled?: boolean;
  children: ReactNode;
}

export function EditorSection({ title, subtitle, defaultOpen = true, disabled = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-[22px] bg-surface shadow-[0_4px_14px_rgba(20,60,45,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="font-display text-sm font-bold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border px-5 py-4">
          {disabled ? (
            // min-w-0 because a fieldset defaults to min-width:min-content, which would stop
            // the grid column from shrinking on narrow screens.
            <fieldset disabled className="m-0 min-w-0 border-0 p-0 opacity-60">
              {children}
            </fieldset>
          ) : (
            children
          )}
        </div>
      )}
    </section>
  );
}
