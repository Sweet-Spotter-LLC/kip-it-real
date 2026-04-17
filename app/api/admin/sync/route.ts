/**
 * POST /api/admin/sync
 *
 * One-click sync from the published Google Sheets baseball-glove catalog.
 * The sheet URL is taken from the SHEETS_CATALOG_URL env var (falls back to
 * the hard-coded published URL so it works out of the box in local dev).
 *
 * Auth: x-admin-secret header (or ?secret= query param).
 *
 * Response:
 *   {
 *     imported:     number,
 *     drafts:       number,
 *     errors:       number,
 *     errorDetails: [{ rowIndex, id, errors }],
 *     bySport:      { baseball, fastpitch, slowpitch },
 *     sheetUrl:     string,
 *     timestamp:    string,
 *   }
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/catalog/adminGate";
import { syncFromSheets, getCatalogUrl } from "@/lib/catalog/sheetsSync";

// ── POST — run a full sync ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const sheetUrl = getCatalogUrl();

  let report;
  try {
    report = await syncFromSheets({ sheetUrl });
  } catch (err) {
    return NextResponse.json(
      { error: `Sync failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ...report, sheetUrl });
}

// ── GET — return current sync config (no secrets exposed) ─────────────────────

export async function GET() {
  return NextResponse.json({
    sheetUrl: getCatalogUrl(),
    configured: Boolean(process.env.SHEETS_CATALOG_URL),
    note: "POST this endpoint (with x-admin-secret header) to trigger a sync.",
  });
}
