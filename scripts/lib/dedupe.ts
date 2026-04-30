/**
 * Kip It Real — duplicate-detection layer for the JBG discovery scrub.
 *
 * Given a parsed JBG candidate and the in-memory catalog, decide whether
 * the candidate is already represented. A candidate is a duplicate if ANY
 * of the following match an existing row, in priority order:
 *
 *   1. JBG numeric product ID extracted from purchaseLinks (highest signal).
 *   2. Normalised SKU (last URL slug segment, lowercased, [^a-z0-9] stripped).
 *   3. (brand_lower, model_number_lower) pair if model can be extracted.
 *
 * Color/finish variants are NOT collapsed — JBG treats them as separate
 * products (different numeric IDs and SKUs) and the existing catalog
 * already has multiple colorway rows per model.
 *
 * Pure functions only — this file is unit-testable in isolation.
 */

import type { SheetRow } from "./sheets-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatalogIndex {
  /** Set of JBG product IDs present in the catalog. */
  productIds: Set<string>;
  /** Set of normalised SKUs (last URL slug segment) present in the catalog. */
  skus: Set<string>;
  /** Set of "brand|model" keys present in the catalog. */
  brandModelPairs: Set<string>;
  /** Lowercased brands present in the catalog (for soft matching). */
  brands: Set<string>;
}

export interface Candidate {
  /** JBG numeric product ID, e.g. "29271". */
  productId?: string;
  /** Last URL slug segment, raw (we'll normalise). */
  urlSlug?: string;
  /** Lowercased brand. */
  brand?: string;
  /** Model number / SKU as parsed from name (e.g. "ano315"). */
  model?: string;
}

export interface DupeMatch {
  isDuplicate: boolean;
  /**
   * Which key triggered the match. One of:
   *   "product_id" | "sku" | "brand_model" | "none"
   */
  matchedBy: "product_id" | "sku" | "brand_model" | "none";
  /** rowNumber of the existing row that matched (best-effort). */
  rowNumber?: number;
}

// ─── Index builder ────────────────────────────────────────────────────────────

const PRODUCT_ID_RE = /\/product\/[^/?#]+\/(\d{2,})\/?/i;
const SLUG_RE = /\/product\/([^/?#]+)\//i;

export function normaliseSku(s: string | undefined): string {
  if (!s) return "";
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function extractProductId(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const m = url.match(PRODUCT_ID_RE);
  return m ? m[1] : undefined;
}

export function extractUrlSlug(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const m = url.match(SLUG_RE);
  return m ? m[1] : undefined;
}

/**
 * Look at one purchaseLinks cell and pull out every URL that looks like a
 * JBG product link. Cells use the catalog's pipe-delimited convention; each
 * record is either a bare URL or "Retailer::URL".
 */
export function jbgUrlsInCell(cell: string | undefined): string[] {
  if (!cell) return [];
  const out: string[] = [];
  for (const record of cell.split("|").map((s) => s.trim()).filter(Boolean)) {
    const colonIdx = record.indexOf("::");
    const url = colonIdx === -1 ? record : record.slice(colonIdx + 2).trim();
    if (/justballgloves\.com/i.test(url)) out.push(url);
  }
  return out;
}

/**
 * Pull a candidate model token out of an existing catalog `id` like
 * "akadema-2026-ano315" → "ano315". Best-effort: takes the last hyphen-
 * separated segment that contains digits or is at least 4 chars.
 */
export function modelFromCatalogId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const parts = id.split("-").filter(Boolean);
  if (parts.length === 0) return undefined;
  // Walk from the right; first segment that looks SKU-ish wins.
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (/\d/.test(p) && p.length >= 3) return p.toLowerCase();
    if (p.length >= 5) return p.toLowerCase();
  }
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Try to extract a model number from a JBG product name.
 * Heuristics:
 *   - Trailing token after ":" — "Wilson A2000 1786 11.5" Glove: WBW100795115" → "wbw100795115"
 *   - Trailing parenthesised SKU — "Miken Player Series ... (PSDCT-10GN)" → "psdct10gn"
 *   - Trailing alphanumeric token in the name with at least one digit.
 */
export function modelFromName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();

  const colonIdx = trimmed.lastIndexOf(":");
  if (colonIdx >= 0) {
    const tail = trimmed.slice(colonIdx + 1).trim();
    const norm = normaliseSku(tail);
    if (norm.length >= 4 && /\d/.test(norm)) return norm;
  }

  const parenMatch = trimmed.match(/\(([^()]+)\)\s*$/);
  if (parenMatch) {
    const norm = normaliseSku(parenMatch[1]);
    if (norm.length >= 4 && /\d/.test(norm)) return norm;
  }

  // Last resort: scan tokens right-to-left for an alphanumeric SKU-shaped
  // word containing a digit.
  const tokens = trimmed.split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const norm = normaliseSku(tokens[i]);
    if (norm.length >= 5 && /\d/.test(norm) && /[a-z]/.test(norm)) return norm;
  }
  return undefined;
}

export function buildCatalogIndex(rows: SheetRow[]): CatalogIndex {
  const productIds = new Set<string>();
  const skus = new Set<string>();
  const brandModelPairs = new Set<string>();
  const brands = new Set<string>();

  for (const r of rows) {
    const links = jbgUrlsInCell(r.data.purchaseLinks);
    for (const url of links) {
      const id = extractProductId(url);
      if (id) productIds.add(id);
      const slug = extractUrlSlug(url);
      const sku = normaliseSku(slug);
      if (sku) skus.add(sku);
    }
    const brand = (r.data.brand ?? "").trim().toLowerCase();
    if (brand) brands.add(brand);
    const model = modelFromCatalogId(r.data.id) ?? modelFromName(r.data.name);
    if (brand && model) brandModelPairs.add(`${brand}|${model}`);
  }

  return { productIds, skus, brandModelPairs, brands };
}

// ─── Dupe check ───────────────────────────────────────────────────────────────

export function isDuplicate(
  candidate: Candidate,
  index: CatalogIndex,
): DupeMatch {
  if (candidate.productId && index.productIds.has(candidate.productId)) {
    return { isDuplicate: true, matchedBy: "product_id" };
  }
  const sku = normaliseSku(candidate.urlSlug);
  if (sku && index.skus.has(sku)) {
    return { isDuplicate: true, matchedBy: "sku" };
  }
  const brand = (candidate.brand ?? "").trim().toLowerCase();
  const model = (candidate.model ?? "").trim().toLowerCase();
  if (brand && model) {
    const key = `${brand}|${model}`;
    if (index.brandModelPairs.has(key)) {
      return { isDuplicate: true, matchedBy: "brand_model" };
    }
  }
  return { isDuplicate: false, matchedBy: "none" };
}
