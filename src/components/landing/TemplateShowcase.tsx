import Link from "next/link";
import type { TemplateId } from "@/types/invoice";

const templates: { id: TemplateId; name: string; description: string; accent: string }[] = [
  { id: "classic", name: "Classic", description: "Traditional business invoice", accent: "#1f2937" },
  { id: "modern", name: "Modern", description: "Clean contemporary design", accent: "#00A97C" },
  { id: "minimal", name: "Minimal", description: "Simple black-and-white layout", accent: "#111111" },
  { id: "business", name: "Business", description: "Corporate-style layout", accent: "#0f766e" },
  { id: "gst", name: "GST", description: "Built for Indian GST invoices", accent: "#b45309" },
];

export function TemplateShowcase() {
  return (
    <div className="mt-14 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
      {templates.map((t) => (
        <Link
          key={t.id}
          href={`/invoice/new?template=${t.id}`}
          className="group rounded-[22px] bg-surface p-3 shadow-[0_4px_14px_rgba(20,60,45,0.06)] transition-transform hover:-translate-y-0.5"
        >
          <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl border border-border bg-white p-3">
            <div className="h-2 w-2/3 rounded-sm" style={{ background: t.accent }} />
            <div className="mt-3 h-1.5 w-1/3 rounded-sm bg-gray-200" />
            <div className="mt-4 space-y-1.5">
              <div className="h-1 w-full rounded-sm bg-gray-100" />
              <div className="h-1 w-full rounded-sm bg-gray-100" />
              <div className="h-1 w-4/5 rounded-sm bg-gray-100" />
            </div>
            <div className="mt-4 space-y-1">
              {[0, 1, 2].map((r) => (
                <div key={r} className="flex justify-between">
                  <div className="h-1 w-1/2 rounded-sm bg-gray-100" />
                  <div className="h-1 w-1/5 rounded-sm bg-gray-100" />
                </div>
              ))}
            </div>
            <div className="mt-4 ml-auto h-2 w-1/3 rounded-sm" style={{ background: t.accent }} />
          </div>
          <p className="mt-3 text-sm font-bold text-foreground">{t.name}</p>
          <p className="text-xs text-muted">{t.description}</p>
        </Link>
      ))}
    </div>
  );
}
