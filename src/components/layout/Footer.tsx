import Link from "next/link";

export function Footer() {
  return (
    <footer className="no-print border-t border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6 lg:px-8">
        <p>&copy; {new Date().getFullYear()} Invoice Generator. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <Link href="/invoice/new" className="hover:text-foreground">
            Create Invoice
          </Link>
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/#faq" className="hover:text-foreground">
            FAQ
          </Link>
        </div>
      </div>
    </footer>
  );
}
