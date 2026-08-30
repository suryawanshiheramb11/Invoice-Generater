"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { faqs } from "@/lib/faqData";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mt-10 divide-y divide-border overflow-hidden rounded-[22px] bg-background shadow-[0_4px_14px_rgba(20,60,45,0.05)]">
      {faqs.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold text-foreground"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
            >
              {item.q}
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div id={`faq-panel-${i}`} className="px-5 pb-4 text-sm text-muted">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
