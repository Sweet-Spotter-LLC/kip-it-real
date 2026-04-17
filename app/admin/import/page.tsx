import { ImportClient } from "@/components/admin/ImportClient";

export const metadata = { title: "Import — Kip It Real Admin" };

export default function ImportPage() {
  const adminSecret = process.env.ADMIN_SECRET ?? "";
  return (
    <div>
      <h1 className="section-heading mb-2">Import catalog</h1>
      <p className="mb-8 text-sm text-brand-support max-w-xl">
        Sync from your published Google Sheets catalog, or paste raw CSV directly.
        Only rows with <code className="rounded bg-brand-bg-deep px-1.5 py-0.5 font-mono text-xs text-brand-primary">status = published</code> are
        written. Errors are surfaced row-by-row so you can fix them in the Sheet before re-syncing.
      </p>
      <ImportClient adminSecret={adminSecret} />
    </div>
  );
}
