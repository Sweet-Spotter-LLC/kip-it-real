"use client";

import { useState } from "react";

interface SyncError {
  rowIndex: number;
  id: string;
  errors: string[];
}

interface SyncResult {
  imported: number;
  drafts: number;
  errors: number;
  errorDetails: SyncError[];
  sheetUrl: string;
  timestamp: string;
}

interface SyncClientProps {
  adminSecret: string;
}

/**
 * SyncClient — interactive sync page for pulling catalog from Google Sheets.
 *
 * Shows a step-by-step progress indicator, final summary, and a collapsible
 * error detail list so you can diagnose validation failures row-by-row.
 */
export function SyncClient({ adminSecret }: SyncClientProps) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  async function runSync() {
    setStatus("running");
    setResult(null);
    setErrorMessage("");
    setShowErrors(false);

    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "x-admin-secret": adminSecret },
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? `HTTP ${res.status}`);
        setStatus("error");
        return;
      }

      setResult(data as SyncResult);
      setStatus("done");
    } catch (err) {
      setErrorMessage("Network error — check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* ── Sheet URL info ─────────────────────────────────────────────── */}
      <div className="card">
        <p className="eyebrow mb-1">Configured sheet</p>
        <p className="text-xs text-brand-support break-all">
          Google Sheets — Glove_CatalogV1_VALIDATED
          {process.env.NEXT_PUBLIC_SHEETS_CATALOG_URL
            ? " (custom via env)"
            : " (default)"}
        </p>
      </div>

      {/* ── Run button ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={runSync}
          disabled={status === "running"}
          className="btn-primary disabled:opacity-50"
        >
          {status === "running" ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              Syncing…
            </span>
          ) : (
            "Run sync now"
          )}
        </button>
        {status === "done" && (
          <a href="/admin" className="text-sm text-brand-accent hover:text-brand-primary font-semibold transition-colors">
            ← Back to dashboard
          </a>
        )}
      </div>

      {/* ── Error message ─────────────────────────────────────────────── */}
      {status === "error" && (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4">
          <p className="font-semibold text-red-700">Sync failed</p>
          <p className="mt-1 text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      {/* ── Result summary ────────────────────────────────────────────── */}
      {result && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard
              label="Imported"
              value={result.imported}
              accent={result.imported > 0}
            />
            <SummaryCard label="Drafts skipped" value={result.drafts} />
            <SummaryCard
              label="Row errors"
              value={result.errors}
              warn={result.errors > 0}
            />
          </div>

          <div className="card text-xs text-brand-support space-y-1">
            <p>
              <span className="font-semibold">Completed:</span>{" "}
              {new Date(result.timestamp).toLocaleString()}
            </p>
            <p className="break-all">
              <span className="font-semibold">Sheet:</span> {result.sheetUrl}
            </p>
          </div>

          {result.errors > 0 && (
            <div className="card">
              <button
                type="button"
                onClick={() => setShowErrors((v) => !v)}
                className="flex w-full items-center justify-between text-sm font-semibold text-brand-primary"
              >
                <span>
                  {result.errors} row{result.errors !== 1 ? "s" : ""} failed validation
                </span>
                <span className="text-brand-support">
                  {showErrors ? "▲ Hide" : "▼ Show"}
                </span>
              </button>

              {showErrors && (
                <ul className="mt-4 flex flex-col gap-3">
                  {result.errorDetails.map((e) => (
                    <li
                      key={e.rowIndex}
                      className="rounded-xl border border-brand-bg-deep bg-brand-bg/50 px-4 py-3"
                    >
                      <p className="text-xs font-semibold text-brand-primary">
                        Row {e.rowIndex}
                        {e.id ? ` — ${e.id}` : ""}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {e.errors.map((err, i) => (
                          <li
                            key={i}
                            className="text-xs text-brand-support before:mr-1 before:content-['•']"
                          >
                            {err}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result.errors === 0 && (
            <div className="rounded-2xl border border-green-300 bg-green-50 px-5 py-4">
              <p className="font-semibold text-green-700">
                ✅ All rows imported cleanly
              </p>
              <p className="mt-1 text-sm text-green-600">
                {result.imported} gloves written to disk.{" "}
                {result.drafts > 0 &&
                  `${result.drafts} draft rows were skipped as expected.`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border px-4 py-4",
        accent
          ? "border-brand-primary bg-brand-primary text-brand-bg"
          : warn && value > 0
            ? "border-amber-300 bg-amber-50 text-brand-text"
            : "border-brand-bg-deep bg-white/60 text-brand-text",
      ].join(" ")}
    >
      <p
        className={[
          "text-xs font-semibold uppercase tracking-[0.15em]",
          accent
            ? "text-brand-accent"
            : warn && value > 0
              ? "text-amber-700"
              : "text-brand-support",
        ].join(" ")}
      >
        {label}
      </p>
      <p
        className={[
          "mt-2 font-display text-3xl font-bold",
          accent ? "text-brand-bg" : warn && value > 0 ? "text-amber-700" : "text-brand-primary",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
