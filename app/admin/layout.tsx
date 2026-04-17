import Link from "next/link";

/**
 * Admin shell layout.
 *
 * Auth model for MVP:
 *  - If ADMIN_SECRET env var is not set, render a "not configured" gate.
 *  - If it IS set, we assume you're accessing from a trusted environment
 *    (Vercel preview URL, local dev, or a team behind auth). For production,
 *    add IP allowlisting or Vercel Password Protection at the platform level.
 *  - Individual API routes still require the x-admin-secret header for
 *    write operations (enforced by adminGate.ts).
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isConfigured = Boolean(process.env.ADMIN_SECRET);

  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-content px-4 py-20 md:px-8 text-center">
        <p className="eyebrow">Admin</p>
        <h1 className="section-heading mt-4">Admin not configured</h1>
        <p className="mt-4 text-sm text-brand-support max-w-md mx-auto">
          Set the <code className="rounded bg-brand-bg-deep px-2 py-0.5 font-mono text-brand-primary">ADMIN_SECRET</code> environment variable
          to enable the admin area. See the project README for setup instructions.
        </p>
        <Link href="/" className="btn-ghost mt-8 inline-flex">
          ← Back to site
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ── Admin nav bar ────────────────────────────────────────────── */}
      <div className="border-b border-brand-bg-deep bg-brand-primary">
        <div className="mx-auto flex max-w-content items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-4">
            <span className="font-display text-sm font-bold text-brand-accent">
              Kip It Real
            </span>
            <span className="text-brand-bg/40">·</span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-bg/70">
              Admin
            </span>
          </div>
          <nav className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em]">
            <Link
              href="/admin"
              className="text-brand-bg/80 hover:text-brand-bg transition-colors px-2 py-1"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/gloves/new"
              className="text-brand-bg/80 hover:text-brand-bg transition-colors px-2 py-1"
            >
              + New glove
            </Link>
            <Link
              href="/admin/import"
              className="text-brand-bg/80 hover:text-brand-bg transition-colors px-2 py-1"
            >
              Import CSV
            </Link>
            <Link
              href="/admin/sync"
              className="text-brand-bg/80 hover:text-brand-bg transition-colors px-2 py-1"
            >
              Sync Sheets
            </Link>
            <Link
              href="/"
              className="ml-2 rounded-lg border border-brand-bg/30 px-3 py-1 text-brand-bg/80 hover:border-brand-bg/60 hover:text-brand-bg transition-colors"
            >
              ← Site
            </Link>
          </nav>
        </div>
      </div>

      {/* ── Admin content ────────────────────────────────────────────── */}
      <div className="mx-auto max-w-content px-4 py-10 md:px-8">
        {children}
      </div>
    </div>
  );
}
