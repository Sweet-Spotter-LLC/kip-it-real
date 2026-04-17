/**
 * POST /api/admin/import
 *
 * Imports glove catalog data from a Google Sheets URL or raw CSV text.
 * Uses the shared sheetsSync library for fetch, parse, validate, and write.
 *
 * Auth: x-admin-secret header (or ?secret= query param).
 *
 * Body (JSON):
 *   { sheetUrl: string }  — fetch CSV from a published Sheets URL
 *   { csvText: string }   — parse raw CSV text directly
 *
 * Response:
 *   {
 *     imported:     number,
 *     drafts:       number,
 *     errors:       number,
 *     errorDetails: [{ rowIndex, id, errors }],
 *     bySport:      { baseball, fastpitch, slowpitch },
 *     timestamp:    string,
 *   }
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/catalog/adminGate";
import { syncFromSheets } from "@/lib/catalog/sheetsSync";

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { sheetUrl, csvText } = body as {
    sheetUrl?: string;
    csvText?: string;
  };

  if (!sheetUrl && !csvText) {
    return NextResponse.json(
      { error: "Provide either sheetUrl or csvText in the request body." },
      { status: 400 },
    );
  }

  let report;
  try {
    report = await syncFromSheets({ sheetUrl, csvText });
  } catch (err) {
    return NextResponse.json(
      { error: `Import failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  return NextResponse.json(report);
}
