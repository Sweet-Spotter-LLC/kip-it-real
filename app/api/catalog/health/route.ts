/**
 * GET /api/catalog/health
 *
 * Live catalog health check. Fetches the Sheets URL directly (bypassing the
 * ISR cache) and reports exactly what the pipeline sees: HTTP status, row
 * count, validation pass/fail, and whether the app would fall back to the
 * limited local JSON files.
 *
 * Publicly accessible — no auth required. Use this to:
 *   - Diagnose why results feel limited
 *   - Set up an external uptime monitor (e.g. Better Uptime, UptimeRobot)
 *     that alerts you when sheets_rows === 0
 *   - Verify a schema change before deploying
 *
 * Response shape:
 *   {
 *     status: "ok" | "degraded" | "fallback",
 *     sheetsAccessible: boolean,
 *     sheetsHttpStatus?: number,
 *     rowsParsed: number,
 *     rowsValid: number,
 *     rowsInvalid: number,
 *     bySport: { baseball, fastpitch, slowpitch },
 *     fallbackCounts: { baseball, fastpitch, slowpitch },
 *     usingFallback: boolean,
 *     sampleErrors: string[],
 *     sheetUrl: string,
 *     checkedAt: string,
 *   }
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getCatalogUrl, parseCsv } from "@/lib/catalog/sheetsSync";
import { validateBatch } from "@/lib/catalog/validation";
import type { SportType } from "@/lib/glove/types";

const DATA_DIR = path.join(process.cwd(), "data", "gloves");

function localCount(sport: SportType): number {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, `${sport}.json`), "utf-8"),
    ) as Array<{ status: string }>;
    return raw.filter((g) => g.status === "published").length;
  } catch {
    return 0;
  }
}

export async function GET() {
  const sheetUrl = getCatalogUrl();
  const checkedAt = new Date().toISOString();

  const fallbackCounts = {
    baseball: localCount("baseball"),
    fastpitch: localCount("fastpitch"),
    slowpitch: localCount("slowpitch"),
  };

  // ── Live fetch — bypass Next.js ISR cache so this always reflects reality ─
  let sheetsAccessible = false;
  let sheetsHttpStatus: number | undefined;
  let csvText: string | null = null;
  let fetchNote: string | null = null;

  try {
    const res = await fetch(sheetUrl, { cache: "no-store" });
    sheetsHttpStatus = res.status;
    if (res.ok) {
      const text = await res.text();
      if (text.trimStart().startsWith("<")) {
        fetchNote = "Response was HTML, not CSV (possible Sheets auth/quota issue)";
      } else {
        csvText = text;
        sheetsAccessible = true;
      }
    } else {
      fetchNote = `HTTP ${res.status} ${res.statusText}`;
    }
  } catch (err) {
    fetchNote = `Network error: ${(err as Error).message}`;
  }

  // ── Parse + validate ──────────────────────────────────────────────────────
  let rowsParsed = 0;
  let rowsValid = 0;
  let rowsInvalid = 0;
  const bySport: Record<SportType, number> = { baseball: 0, fastpitch: 0, slowpitch: 0 };
  const sampleErrors: string[] = [];

  if (csvText) {
    const rows = parseCsv(csvText);
    rowsParsed = rows.length;

    const { valid, invalid } = validateBatch(rows);
    rowsValid = valid.length;
    rowsInvalid = invalid.length;

    for (const g of valid) {
      if (g.sport in bySport) bySport[g.sport as SportType]++;
    }

    for (const i of invalid.slice(0, 5)) {
      sampleErrors.push(
        `row ${i.rowIndex} (${i.raw.id ?? "?"}): ${i.errors.slice(0, 2).join("; ")}`,
      );
    }
  }

  // ── Determine overall status ──────────────────────────────────────────────
  const usingFallback = rowsValid === 0;
  const status = usingFallback
    ? "fallback"
    : rowsInvalid > rowsValid
    ? "degraded"
    : "ok";

  return NextResponse.json(
    {
      status,
      sheetsAccessible,
      sheetsHttpStatus,
      fetchNote: fetchNote ?? undefined,
      rowsParsed,
      rowsValid,
      rowsInvalid,
      bySport,
      fallbackCounts,
      usingFallback,
      sampleErrors,
      sheetUrl,
      checkedAt,
    },
    {
      // Never cache this response — it must always reflect the live state.
      headers: { "Cache-Control": "no-store" },
    },
  );
}
