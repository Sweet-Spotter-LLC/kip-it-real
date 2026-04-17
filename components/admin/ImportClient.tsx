"use client";

import { useState } from "react";

interface ImportClientProps {
  adminSecret: string;
}

interface ImportResult {
  imported: number;
  drafts: number;
  errors: number;
  errorDetails: Array<{ rowIndex: number; id: string; errors: string[] }>;
}

/**
 * CSV import UI.
 * Paste raw CSV or a Sheets URL — the API validates every row and writes
 * valid published gloves to the appropriate sport JSON file.
 */
export function ImportClient({ adminSecret }: ImportClientProps) {
  const [mode, setMode] = useState<"csv" | "url">("url");
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleImport() {
    if (!input.trim()) return;
    setRunning(true);
    setResult(null);
    setErrorMsg("");

    const body =
      mode === "url"
        ? { sheetUrl: input.trim() }
        : { csvText: input.trim() };

    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error ?? "Import failed.");
    } else {
      setResult(data as ImportResult);
    }
    setRunning(false);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Mode toggle ─────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {(["url", "csv"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={[
              "rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all",
              mode === m
                ? "border-brand-primary bg-brand-primary text-brand-bg"
                : "border-brand-bg-deep bg-white/60 text-brand-text hover:border-brand-accent",
            ].join(" ")}
          >
            {m === "url" ? "Google Sheets URL" : "Paste raw CSV"}
          </button>
        ))}
      </div>

      {/* ── Input ───────────────────────────────────────────────────── */}
      <div className="card flex flex-col gap-4">
        {mode === "url" ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Published Sheets URL</span>
              <input
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/…/pub?output=csv"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full rounded-xl border border-brand-bg-deep bg-white/80 px-4 py-2 text-sm focus:border-brand-accent focus:outline-none"
              />
            </label>
            <p className="text-xs text-brand-support">
              File → Share → Publish to web → Comma-separated values (.csv) → Copy URL
            </p>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">CSV content</span>
              <textarea
                rows={10}
                placeholder="id,name,brand,year,sport,..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full rounded-xl border border-brand-bg-deep bg-white/80 px-4 py-2 font-mono text-xs focus:border-brand-accent focus:outline-none"
              />
            </label>
          </>
        )}

        <button
          type="button"
          onClick={handleImport}
          disabled={running || !input.trim()}
          className="btn-primary self-start disabled:opacity-50"
        >
          {running ? "Importing…" : "Run import"}
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* ── Result ──────────────────────────────────────────────────── */}
      {result && (
        <div className="card flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-4">
            <SummaryCell
              label="Imported"
              value={result.imported}
              accent={result.imported > 0}
            />
            <SummaryCell label="Drafts skipped" value={result.drafts} />
            <SummaryCell
              label="Errors"
              value={result.errors}
              warn={result.errors > 0}
            />
          </div>

          {result.errorDetails.length > 0 && (
            <div>
              <h3 className="font-display text-lg font-bold text-brand-primary mb-4">
                Rows with errors — fix in Sheet before next sync
              </h3>
              <div className="flex flex-col gap-3">
                {result.errorDetails.map((detail) => (
                  <div
                    key={`${detail.rowIndex}-${detail.id}`}
                    className="rounded-xl border border-brand-bg-deep bg-white/60 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-brand-primary">
                      Row {detail.rowIndex}{" "}
                      <span className="font-normal text-brand-support">
                        id: &quot;{detail.id || "(missing)"}&quot;
                      </span>
                    </p>
                    <ul className="mt-2 space-y-1">
                      {detail.errors.map((e, i) => (
                        <li key={i} className="flex gap-2 text-xs text-brand-support">
                          <span aria-hidden="true">·</span>
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.imported > 0 && (
            <p className="text-sm text-brand-support">
              Catalog JSON files updated. Restart the dev server (or redeploy) to
              see changes in the public site.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCell({
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
          ? "border-brand-primary bg-brand-primary/5"
          : warn && value > 0
          ? "border-red-200 bg-red-50"
          : "border-brand-bg-deep bg-white/60",
      ].join(" ")}
    >
      <p className="eyebrow">{label}</p>
      <p
        className={[
          "mt-2 font-display text-3xl font-bold",
          accent ? "text-brand-primary" : warn && value > 0 ? "text-red-600" : "text-brand-text",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
