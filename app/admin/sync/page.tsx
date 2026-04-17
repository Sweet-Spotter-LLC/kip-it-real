import { SyncClient } from "@/components/admin/SyncClient";

export const metadata = { title: "Sync Catalog — Kip It Real Admin" };

export default function SyncPage() {
  const adminSecret = process.env.ADMIN_SECRET ?? "";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="eyebrow">Admin</p>
        <h1 className="section-heading mt-2">Sync from Google Sheets</h1>
        <p className="mt-2 text-sm text-brand-support max-w-prose">
          Pulls the latest catalog from the published Google Sheet, validates every row,
          and writes updated JSON files to disk. Rows marked as{" "}
          <code className="rounded bg-brand-bg-deep/60 px-1 text-xs">draft</code> in
          the sheet are skipped and not written.
        </p>
      </div>

      <SyncClient adminSecret={adminSecret} />
    </div>
  );
}
