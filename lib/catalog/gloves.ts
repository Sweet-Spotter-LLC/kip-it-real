/**
 * Kip It Real — runtime glove catalog loader.
 *
 * Fetches the published Google Sheets catalog CSV on the server and returns
 * validated GloveProduct records. Uses Next.js fetch() caching so the sheet
 * is re-fetched at most once every 5 minutes (ISR-style revalidation).
 *
 * ⚠  Server-side only. Never import this in client components.
 *
 * The sheet URL is read from the SHEETS_CATALOG_URL env var, or falls back
 * to the hard-coded published URL in sheetsSync.ts.
 *
 * Monitoring: set CATALOG_ALERT_WEBHOOK_URL (Slack incoming webhook or any
 * HTTP POST endpoint) to receive an alert whenever the live Sheets fetch
 * falls back to the limited local JSON files.
 */

import fs from "fs";
import path from "path";
import { getCatalogUrl, parseCsv } from "./sheetsSync";
import { validateBatch } from "./validation";
import type { GloveProduct, SportType } from "../glove/types";

// ─── Local JSON fallback ──────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data", "gloves");

/**
 * Reads the sport-specific JSON files from disk as a fallback when the Sheets
 * fetch fails or returns no results. The JSON files are the last-synced copy
 * of the catalog — stale is better than empty.
 */
function loadFromLocalJson(
  sport?: SportType,
  includeDrafts = false,
): GloveProduct[] {
  const sports: SportType[] = sport
    ? [sport]
    : ["baseball", "fastpitch", "slowpitch"];
  const results: GloveProduct[] = [];

  for (const s of sports) {
    const filePath = path.join(DATA_DIR, `${s}.json`);
    try {
      const raw = JSON.parse(
        fs.readFileSync(filePath, "utf-8"),
      ) as GloveProduct[];
      const filtered = includeDrafts
        ? raw
        : raw.filter((g) => g.status === "published");
      results.push(...filtered);
    } catch {
      // File may not exist for this sport yet — skip silently.
    }
  }

  return results;
}

// ─── Monitoring ───────────────────────────────────────────────────────────────

/**
 * Posts a structured alert to CATALOG_ALERT_WEBHOOK_URL when the live Sheets
 * fetch falls back to limited local data. Compatible with Slack incoming
 * webhooks, Discord webhooks (via adapter), Make, Zapier, or any service that
 * accepts a JSON POST.
 *
 * Non-blocking — a failure here must never prevent catalog results from loading.
 */
async function alertFallback(opts: {
  reason: string;
  rowsParsed: number;
  rowsValid: number;
  fallbackCount: number;
  sheetUrl: string;
  sampleErrors: string[];
}): Promise<void> {
  const webhookUrl = process.env.CATALOG_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const lines = [
    `⚠️ *Kip It Real catalog alert* — serving limited local fallback`,
    `Reason: ${opts.reason}`,
    `Rows parsed from Sheets: ${opts.rowsParsed}`,
    `Rows that passed validation: ${opts.rowsValid}`,
    `Fallback catalog size: ${opts.fallbackCount} gloves`,
    opts.sampleErrors.length > 0
      ? `Sample validation errors:\n${opts.sampleErrors.map((e) => `  • ${e}`).join("\n")}`
      : "",
    `Sheet URL: ${opts.sheetUrl}`,
    `Time: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines }),
      // @ts-ignore – Next.js fetch option
      next: { revalidate: 0 },
    });
  } catch (err) {
    console.error("[catalog] Failed to post alert webhook:", err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface LoadCatalogOptions {
  /** Include draft records. Default false (only published). */
  includeDrafts?: boolean;
  /** Filter to a specific sport. Default: all sports. */
  sport?: SportType;
}

/**
 * Fetches, parses, and returns the glove catalog from Google Sheets.
 *
 * Results are cached server-side for 5 minutes via Next.js ISR semantics,
 * so this is safe to call on every request without hammering Google.
 *
 * Call this from Server Components, API routes, and the scoring pipeline.
 * Never call it from client components.
 */
export async function loadCatalog(
  opts: LoadCatalogOptions = {},
): Promise<GloveProduct[]> {
  const { includeDrafts = false, sport } = opts;

  const url = getCatalogUrl();

  // ── 1. Fetch with Next.js ISR caching (revalidate every 5 min) ──────────
  let csvText: string | null = null;
  let fetchError: string | null = null;

  try {
    const res = await fetch(url, {
      // Next.js extends fetch() to support cache revalidation.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore – Next.js-specific option not in base RequestInit types
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      fetchError = `HTTP ${res.status} ${res.statusText}`;
      console.error(`[catalog] ${fetchError} fetching catalog CSV — will fall back`);
    } else {
      const text = await res.text();
      // Sanity check: Google sometimes returns an HTML error page with 200.
      if (text.trimStart().startsWith("<")) {
        fetchError = "Response was HTML (not CSV) — possible Sheets auth or quota issue";
        console.error(`[catalog] ${fetchError}`);
      } else {
        csvText = text;
      }
    }
  } catch (err) {
    fetchError = (err as Error).message;
    console.error("[catalog] Network error fetching catalog CSV:", fetchError);
  }

  // ── 2. Parse + validate (only when Sheets returned usable data) ───────────
  let gloves: GloveProduct[] = [];
  let rowsParsed = 0;
  let rowsValid = 0;
  let sampleErrors: string[] = [];

  if (csvText) {
    const rows = parseCsv(csvText);
    rowsParsed = rows.length;

    const { valid, invalid } = validateBatch(rows);
    rowsValid = valid.length;

    console.log(
      `[catalog] Sheets CSV: ${rowsParsed} rows parsed, ` +
      `${rowsValid} valid, ${invalid.length} invalid`,
    );

    if (invalid.length > 0) {
      // Log first few errors so the dev log reveals schema mismatches quickly.
      sampleErrors = invalid.slice(0, 5).map(
        (i) => `row ${i.rowIndex} (${i.raw.id ?? "?"}): ${i.errors.slice(0, 2).join("; ")}`,
      );
      console.warn("[catalog] Sample validation errors:", sampleErrors.join(" | "));
    }

    gloves = includeDrafts
      ? valid
      : valid.filter((g) => g.status === "published");

    if (sport) {
      gloves = gloves.filter((g) => g.sport === sport);
    }
  }

  // ── 3. Fall back to local JSON when Sheets returned nothing valid ─────────
  if (gloves.length === 0) {
    const fallback = loadFromLocalJson(sport, includeDrafts);

    const reason = fetchError
      ? `Sheets fetch failed: ${fetchError}`
      : rowsParsed === 0
      ? "CSV parsed to 0 rows (empty sheet or URL issue)"
      : `All ${rowsParsed} rows failed validation — possible schema mismatch`;

    console.error(
      `[catalog] ⚠ FALLING BACK to local JSON (${fallback.length} gloves). ` +
      `Reason: ${reason}`,
    );

    // Fire-and-forget alert to the admin webhook.
    void alertFallback({
      reason,
      rowsParsed,
      rowsValid,
      fallbackCount: fallback.length,
      sheetUrl: url,
      sampleErrors,
    });

    return fallback;
  }

  return gloves;
}

/**
 * Loads a single glove by id.
 * Returns undefined if not found or on error.
 */
export async function loadGloveById(
  id: string,
  opts: LoadCatalogOptions = {},
): Promise<GloveProduct | undefined> {
  const catalog = await loadCatalog(opts);
  return catalog.find((g) => g.id === id);
}

/**
 * Returns catalog metadata — useful for the admin dashboard status widget.
 */
export interface CatalogMeta {
  totalPublished: number;
  totalDraft: number;
  byBrand: Record<string, number>;
  bySport: Record<SportType, number>;
  lastVerifiedDates: string[];
}

export async function getCatalogMeta(): Promise<CatalogMeta> {
  const all = await loadCatalog({ includeDrafts: true });

  const byBrand: Record<string, number> = {};
  const bySport: Record<SportType, number> = {
    baseball: 0,
    fastpitch: 0,
    slowpitch: 0,
  };
  const lastVerifiedDates: string[] = [];

  for (const g of all) {
    byBrand[g.brand] = (byBrand[g.brand] ?? 0) + 1;
    bySport[g.sport] += 1;
    if (g.lastVerified) lastVerifiedDates.push(g.lastVerified);
  }

  return {
    totalPublished: all.filter((g) => g.status === "published").length,
    totalDraft: all.filter((g) => g.status === "draft").length,
    byBrand,
    bySport,
    lastVerifiedDates: [...new Set(lastVerifiedDates)].sort().reverse(),
  };
}
