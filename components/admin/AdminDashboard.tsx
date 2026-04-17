"use client";

import { useState } from "react";
import Link from "next/link";
import type { GloveProduct } from "@/lib/glove/types";
import type { CatalogMeta } from "@/lib/catalog/gloves";
import { POSITION_LABELS, SPORT_LABELS } from "@/lib/glove/constants";

interface AdminDashboardProps {
  catalog: GloveProduct[];
  meta: CatalogMeta;
  adminSecret: string;
}

/**
 * Admin dashboard — client component so filter state is interactive.
 * Data is loaded server-side in the page and passed as props.
 */
export function AdminDashboard({ catalog, meta, adminSecret }: AdminDashboardProps) {
  const [sport, setSport] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [brand, setBrand] = useState<string>("");
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  // ── Filtering ────────────────────────────────────────────────────────────
  const filtered = catalog.filter((g) => {
    if (sport && g.sport !== sport) return false;
    if (status && g.status !== status) return false;
    if (brand && g.brand !== brand) return false;
    if (query && !g.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  // ── Brands for filter dropdown ───────────────────────────────────────────
  const allBrands = [...new Set(catalog.map((g) => g.brand))].sort();

  // ── Status toggle ────────────────────────────────────────────────────────
  async function toggleStatus(glove: GloveProduct) {
    const newStatus = glove.status === "published" ? "draft" : "published";
    const res = await fetch(`/api/admin/gloves/${glove.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      // Optimistic UI — reload the page to reflect the change
      window.location.reload();
    } else {
      alert("Failed to update status. Check the console.");
    }
  }

  // ── Sheet sync ───────────────────────────────────────────────────────────
  async function handleSync() {
    if (!confirm("Sync catalog from the configured Google Sheet? This will overwrite local JSON files.")) return;
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "x-admin-secret": adminSecret },
      });
      const data = await res.json();
      if (res.ok) {
        const errNote = data.errors > 0 ? `, ${data.errors} rows had errors` : "";
        setSyncMsg(
          `✅ Sync complete — ${data.imported} imported, ${data.drafts} drafts skipped${errNote}. Reloading…`,
        );
        setTimeout(() => window.location.reload(), 2500);
      } else {
        setSyncMsg(`❌ Sync failed: ${data.error}`);
      }
    } catch {
      setSyncMsg("❌ Network error during sync.");
    }
    setSyncing(false);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Meta cards ────────────────────────────────────────────────── */}
      <section>
        <h1 className="section-heading">Catalog dashboard</h1>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetaCard label="Published" value={meta.totalPublished} accent />
          <MetaCard label="Drafts" value={meta.totalDraft} />
          <MetaCard label="Total" value={catalog.length} />
          <MetaCard
            label="Last verified"
            value={meta.lastVerifiedDates[0] ?? "—"}
            small
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {(Object.entries(meta.bySport) as [string, number][]).map(
            ([s, n]) => (
              <div
                key={s}
                className="rounded-2xl border border-brand-bg-deep bg-white/60 px-4 py-3"
              >
                <p className="eyebrow">{SPORT_LABELS[s as keyof typeof SPORT_LABELS] ?? s}</p>
                <p className="mt-1 font-display text-xl font-bold text-brand-primary">
                  {n}
                </p>
              </div>
            ),
          )}
        </div>
      </section>

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <section className="flex flex-wrap gap-3">
        <Link href="/admin/gloves/new" className="btn-primary">
          + New glove
        </Link>
        <Link href="/admin/import" className="btn-secondary">
          Import CSV
        </Link>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="btn-secondary disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync from Sheets"}
        </button>
      </section>
      {syncMsg && (
        <p className="rounded-2xl border border-brand-bg-deep bg-white/60 px-4 py-3 text-sm text-brand-text">
          {syncMsg}
        </p>
      )}

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <section className="card">
        <div className="grid gap-4 md:grid-cols-4">
          <input
            type="text"
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-xl border border-brand-bg-deep bg-white/80 px-4 py-2 text-sm focus:border-brand-accent focus:outline-none"
          />
          <FilterSelect
            label="Sport"
            value={sport}
            onChange={setSport}
            options={["baseball", "fastpitch", "slowpitch"]}
            labelMap={SPORT_LABELS}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={["published", "draft"]}
          />
          <FilterSelect
            label="Brand"
            value={brand}
            onChange={setBrand}
            options={allBrands}
          />
        </div>
        <p className="mt-3 text-xs text-brand-support">
          Showing {filtered.length} of {catalog.length} gloves
        </p>
      </section>

      {/* ── Catalog table ─────────────────────────────────────────────── */}
      <section className="overflow-x-auto rounded-2xl border border-brand-bg-deep bg-white/80">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-bg-deep text-left">
              <Th>Name</Th>
              <Th>Brand</Th>
              <Th>Sport</Th>
              <Th>Positions</Th>
              <Th>Size</Th>
              <Th>Price</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr
                key={g.id}
                className="border-b border-brand-bg-deep/50 transition-colors hover:bg-brand-bg-deep/20"
              >
                <td className="px-4 py-3 font-semibold text-brand-primary">
                  {g.name}
                </td>
                <td className="px-4 py-3 text-brand-text">{g.brand}</td>
                <td className="px-4 py-3 text-brand-text capitalize">
                  {g.sport}
                </td>
                <td className="px-4 py-3 text-brand-support text-xs">
                  {g.positionTags.map((p) => POSITION_LABELS[p]).join(", ")}
                </td>
                <td className="px-4 py-3 text-brand-text">{g.sizeInches}&quot;</td>
                <td className="px-4 py-3 text-brand-text">${g.price}</td>
                <td className="px-4 py-3">
                  <span
                    className={[
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      g.status === "published"
                        ? "bg-brand-primary/10 text-brand-primary"
                        : "bg-brand-support/10 text-brand-support",
                    ].join(" ")}
                  >
                    {g.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/gloves/${g.id}`}
                      className="text-brand-accent hover:text-brand-primary text-xs font-semibold transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleStatus(g)}
                      className="text-brand-support hover:text-brand-primary text-xs font-semibold transition-colors"
                    >
                      {g.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-brand-support"
                >
                  No gloves match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetaCard({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border px-4 py-4",
        accent
          ? "border-brand-primary bg-brand-primary text-brand-bg"
          : "border-brand-bg-deep bg-white/60 text-brand-text",
      ].join(" ")}
    >
      <p
        className={[
          "text-xs font-semibold uppercase tracking-[0.18em]",
          accent ? "text-brand-accent" : "text-brand-support",
        ].join(" ")}
      >
        {label}
      </p>
      <p
        className={[
          "mt-2 font-display font-bold",
          small ? "text-lg" : "text-3xl",
          accent ? "text-brand-bg" : "text-brand-primary",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  labelMap,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labelMap?: Record<string, string>;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-brand-bg-deep bg-white/80 px-4 py-2 text-sm focus:border-brand-accent focus:outline-none"
    >
      <option value="">All {label.toLowerCase()}s</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {labelMap?.[o] ?? o}
        </option>
      ))}
    </select>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-brand-support">
      {children}
    </th>
  );
}
