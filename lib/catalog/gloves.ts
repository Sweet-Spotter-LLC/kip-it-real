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
 */

import { getCatalogUrl, parseCsv } from "./sheetsSync";
import { validateBatch } from "./validation";
import type { GloveProduct, SportType } from "../glove/types";

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
  let csvText: string;
  try {
    const res = await fetch(url, {
      // Next.js extends fetch() to support cache revalidation.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore – Next.js-specific option not in base RequestInit types
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error(`[catalog] HTTP ${res.status} fetching catalog CSV — returning empty catalog`);
      return [];
    }
    csvText = await res.text();
  } catch (err) {
    console.error("[catalog] Failed to fetch catalog CSV:", err);
    return [];
  }

  // ── 2. Parse CSV ─────────────────────────────────────────────────────────
  const rows = parseCsv(csvText);

  // ── 3. Validate ──────────────────────────────────────────────────────────
  const { valid } = validateBatch(rows);

  // ── 4. Filter ────────────────────────────────────────────────────────────
  let gloves = valid;

  if (!includeDrafts) {
    gloves = gloves.filter((g) => g.status === "published");
  }

  if (sport) {
    gloves = gloves.filter((g) => g.sport === sport);
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
