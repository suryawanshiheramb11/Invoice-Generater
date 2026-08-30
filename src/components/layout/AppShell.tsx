"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { FileText, LayoutDashboard, LogOut, Menu, Plus, Settings, Users, X } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Clients", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function initials(nameOrEmail: string) {
  const base = nameOrEmail.split("@")[0];
  const parts = base.split(/[.\s_-]+/).filter(Boolean);
  const chars = parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return chars.toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const email = user?.email ?? "";

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      {/* Mobile top bar */}
      <header className="no-print flex items-center justify-between bg-ink px-4 py-3.5 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-display font-extrabold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <FileText className="h-4.5 w-4.5" />
          </span>
          Invoice Generator
        </Link>
        <button
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="rounded-xl p-2 text-white hover:bg-white/10"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {mobileOpen && (
        <nav className="no-print flex flex-col gap-1 bg-ink px-4 pb-4 lg:hidden">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold text-muted-on-ink",
                  active && "bg-ink-soft text-white"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/invoice/new"
            onClick={() => setMobileOpen(false)}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-bold text-accent-foreground"
          >
            <Plus className="h-4 w-4" /> New invoice
          </Link>
          <button
            onClick={handleLogout}
            className="mt-2 flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-bold text-muted-on-ink"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col bg-ink px-[18px] py-6 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-1 font-display font-extrabold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
            <FileText className="h-4.5 w-4.5" />
          </span>
          <span className="tracking-tight">Invoice Gen</span>
        </Link>

        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold text-muted-on-ink transition-colors hover:bg-ink-soft hover:text-white",
                  active && "bg-ink-soft text-white"
                )}
              >
                <span className={cn("h-2 w-2 rounded-sm", active ? "bg-accent" : "bg-ink-line")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/invoice/new"
          className="mt-5 flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-bold text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" /> New invoice
        </Link>

        <div className="mt-auto flex items-center gap-2.5 rounded-2xl bg-ink-soft p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent font-display text-xs font-bold text-accent-foreground">
            {email ? initials(email) : "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{email || "Account"}</p>
            <button onClick={handleLogout} className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-muted-on-ink hover:text-white">
              <LogOut className="h-3 w-3" /> Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-background">{children}</main>
    </div>
  );
}
