"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function Navbar() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-display font-extrabold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <FileText className="h-4.5 w-4.5" />
          </span>
          <span className="hidden tracking-tight sm:inline">Invoice Generator</span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          {loading ? null : user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
                </Button>
              </Link>
              <span className="mr-1 max-w-[160px] truncate text-sm text-muted">{user.email}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5" /> Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/invoice/new">
                <Button variant="ghost" size="sm">
                  Create Invoice
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="primary" size="sm">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>

        <button
          className="rounded-xl p-2 text-foreground hover:bg-black/[0.04] md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-surface px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            <Link
              href={user ? "/dashboard" : "/invoice/new"}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-black/[0.04]"
            >
              {user ? "Dashboard" : "Create Invoice"}
            </Link>
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {user ? (
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="h-3.5 w-3.5" /> Logout
                </Button>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full">
                      Login
                    </Button>
                  </Link>
                  <Link href="/signup" onClick={() => setOpen(false)}>
                    <Button variant="primary" size="sm" className="w-full">
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
