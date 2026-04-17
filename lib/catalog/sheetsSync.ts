/**
 * Kip It Real — Google Sheets catalog sync library.
 *
 * Fetches a published Google Sheet as CSV, parses it, validates every row,
 * and writes the results to the appropriate data/gloves/<sport>.json files.
 *
 * Designed to be called from:
 *   - app/api/admin/sync/route.ts   (one-click sync via the admin UI)
 *   - app/api/admin/import/route.ts (manual import with arbitrary URL)
 *   - scripts/sync-sheets.ts        (CLI / CI trigger)
 *
 * Server-side only — uses Node `https`, `fs`, and `path`.
 */

import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { validateBatch } from "./validation";
import type { GloveProduct } from "../glove/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data", "gloves");

const SPORT_FILES: Record<string, string> = {
  baseball: path.join(DATA_DIR, "baseball.json"),
  fastpitch: path.join(DATA_DIR, "fastpitch.json"),
  slowpitch: path.join(DATA_DIR, "slowpitch.json"),
};

/** The default published catalog URL (baseball). Override via SHEETS_CATALOG_URL env. */
export const DEFAULT_CATALOG_URL =
  "https://docs.google.com/spreadsheets/d/e/" +
  "2PACX-1vQs-1UQbA-EJXVckBEuKo9y28nudojpswcuJS2RWCv12pdvIokddEBuRvMHOSgfokUREpblVgBtqE_5" +
  "/pub?output=csv";

export function getCatalogUrl(): string {
  return process.env.SHEETS_CATALOG_URL ?? DEFAULT_CATALOG_URL;
}

// ─── URL normaliser ───────────────────────────────────────────────────────────

/**
 * Accepts any published Google Sheets URL variant and returns a direct CSV URL.
 *
 * Supported input formats:
 *   - Already contains "output=csv" or "format=csv" → returned as-is
 *   - Contains "/pubhtml"  → rewritten to /export?format=csv
 *   - Contains "/pub"      → appends ?output=csv
 *   - Anything else        → throws
 */
export function toCsvUrl(input: string): string {
  if (input.includes("output=csv") || input.includes("format=csv")) return input;
  if (input.includes("/pubhtml")) {
    const url = new URL(input);
    // Extract the spreadsheet ID from the path: /spreadsheets/d/e/<id>/pubhtml
    const parts = url.pathname.split("/");
    const eIdx = parts.indexOf("e");
    const sheetId = eIdx !== -1 ? parts[eIdx + 1] : "";
    const gid = url.searchParams.get("gid") ?? "0";
    return (
      `https://docs.google.com/spreadsheets/d/e/${sheetId}` +
      `/pub?output=csv&gid=${gid}`
    );
  }
  if (input.includes("/pub")) {
    const sep = input.includes("?") ? "&" : "?";
    return `${input}${sep}output=csv`;
  }
  throw new Error(
    `Unrecognised Sheets URL format: "${input}". ` +
      `Use a published /pub or /pubhtml URL from File → Share → Publish to web.`,
  );
}

// ─── HTTP fetch with redirect following ───────────────────────────────────────

export function fetchCsv(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        // Follow redirects (Google often redirects the CSV export).
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return fetchCsv(res.headers.location).then(resolve).catch(reject);
        }
        if (!res.statusCode || res.statusCode >= 400) {
          return reject(
            new Error(`HTTP ${res.statusCode} fetching catalog CSV`),
          );
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

/**
 * Minimal RFC 4180-compliant CSV parser.
 * Handles: quoted fields, escaped double-quotes (""), CRLF and LF line endings.
 * Returns an array of objects keyed by the first (header) row.
 */
export function parseCsv(text: string): Record<string, unknown>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 2;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Flush the last row if the file didn't end with a newline.
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length < 2) return [];

  const [headers, ...dataRows] = rows;
  const trimmedHeaders = headers.map((h) => h.trim());

  return dataRows
    .filter((r) => r.some((c) => c.trim())) // skip blank rows
    .map((r) => {
      const obj: Record<string, unknown> = {};
      trimmedHeaders.forEach((h, idx) => {
        obj[h] = (r[idx] ?? "").trim();
      });
      return obj;
    });
}

// ─── File writer ──────────────────────────────────────────────────────────────

function writeSportFile(sport: string, gloves: GloveProduct[]): void {
  const filePath = SPORT_FILES[sport];
  if (!filePath) {
    console.warn(`[sheetsSync] Unknown sport "${sport}" — skipping write`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(gloves, null, 2), "utf-8");
  console.log(`[sheetsSync] Wrote ${gloves.length} ${sport} gloves → ${filePath}`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SyncOptions {
  /** Published Google Sheets URL (or CSV export URL). */
  sheetUrl?: string;
  /** Pass raw CSV text directly (skips HTTP fetch — useful in tests). */
  csvText?: string;
}

export interface SyncReport {
  imported: number;
  drafts: number;
  errors: number;
  errorDetails: Array<{
    rowIndex: number;
    id: string;
    errors: string[];
  }>;
  bySport: Record<string, number>;
  timestamp: string;
}

/**
 * Full sync pipeline:
 *  1. Fetch CSV from Google Sheets (or use provided text)
 *  2. Parse CSV rows
 *  3. Skip draft rows
 *  4. Validate all published rows
 *  5. Bucket by sport and write JSON files to disk
 *  6. Return a SyncReport
 */
export async function syncFromSheets(
  opts: SyncOptions = {},
): Promise<SyncReport> {
  const url = opts.sheetUrl ?? getCatalogUrl();

  // ── 1. Fetch ─────────────────────────────────────────────────────────────
  let raw: string;
  if (opts.csvText) {
    raw = opts.csvText;
  } else {
    const csvUrl = toCsvUrl(url);
    raw = await fetchCsv(csvUrl);
  }

  // ── 2. Parse ─────────────────────────────────────────────────────────────
  const allRows = parseCsv(raw);

  // ── 3. Separate drafts ───────────────────────────────────────────────────
  let draftCount = 0;
  const publishedRows = allRows.filter((r) => {
    if ((r.status as string)?.trim() === "draft") {
      draftCount++;
      return false;
    }
    return true;
  });

  // ── 4. Validate ──────────────────────────────────────────────────────────
  const { valid, invalid } = validateBatch(publishedRows);

  // ── 5. Bucket by sport + write ───────────────────────────────────────────
  const bySport: Record<string, GloveProduct[]> = {
    baseball: [],
    fastpitch: [],
    slowpitch: [],
  };

  for (const glove of valid) {
    if (bySport[glove.sport]) {
      bySport[glove.sport].push(glove);
    }
  }

  for (const [sport, gloves] of Object.entries(bySport)) {
    if (gloves.length > 0) {
      writeSportFile(sport, gloves);
    }
  }

  // ── 6. Return report ─────────────────────────────────────────────────────
  const bySportCount: Record<string, number> = {};
  for (const [sport, gloves] of Object.entries(bySport)) {
    bySportCount[sport] = gloves.length;
  }

  return {
    imported: valid.length,
    drafts: draftCount,
    errors: invalid.length,
    errorDetails: invalid.map((i) => ({
      rowIndex: i.rowIndex,
      id: (i.raw.id as string) ?? "",
      errors: i.errors,
    })),
    bySport: bySportCount,
    timestamp: new Date().toISOString(),
  };
}
