// @ts-nocheck — dev script run via tsx; sheets-client API not yet finalised
/**
 * Kip It Real — weekly JustBallGloves new-glove discovery scrub.
 *
 * Run modes:
 *   npm run scrub:gloves            → live, appends new rows to the sheet
 *   npm run scrub:gloves:dry-run    → reports only, no Sheets writes
 *
 * Direct invocation:
 *   tsx scripts/discover-jbg-new.ts --dry-run
 *   tsx scripts/discover-jbg-new.ts --live
 *   tsx scripts/discover-jbg-new.ts --dry-run --max-candidates=10
 *   tsx scripts/discover-jbg-new.ts --dry-run --only-sport=fastpitch
 *
 * Env vars (see .env.example):
 *   GOOGLE_SHEETS_CLIENT_EMAIL
 *   GOOGLE_SHEETS_PRIVATE_KEY     ("\n" sequences are auto-unescaped)
 *   GOOGLE_SHEETS_SPREADSHEET_ID
 *   GOOGLE_SHEETS_TAB_NAME        defaults to "Glove-template"
 *   LIVE_UPDATE                   "true" → live; anything else → dry-run
 *
 * Hard guardrails (see also the per-module headers):
 *   - Append-only. No update / delete code path.
 *   - inProduction=false on every appended row, always.
 *   - Scoring fields blank on every appended row, always.
 *   - Schema check vs. row 1 — abort BEFORE any write if columns drifted.
 *   - Numeric product ID required in the affiliate URL — skip + log to
 *     review otherwise.
 *   - Exclusion regex applied — skip + log to review otherwise.
 *   - Polite 1 req/sec pacing to JBG with retry/backoff.
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

import {
  loadSheetsConfig,
  buildSheetsClient,
  readCatalogTable,
  appendRows,
  type AppendCells,
  type CatalogTable,
} from "./lib/sheets-client";
import {
  buildCatalogIndex,
  isDuplicate,
  modelFromName as productModelFromName,
  type Candidate,
} from "./lib/dedupe";
import {
  discoverNewListings,
  EXCLUSION_RE,
  type DiscoverSport,
} from "./lib/jbg-discover";
import { inspectJbgProduct, canonicalAffiliateUrl } from "./lib/jbg-product";
import type { ParsedProduct } from "./lib/jbg-product";

// ─── Required column list ─────────────────────────────────────────────────────

/**
 * The full canonical column set. The discovery scrub requires every one
 * of these columns to be present in the sheet — if even one is missing
 * we abort BEFORE any append. Extra columns are tolerated.
 */
const REQUIRED_COLUMNS = [
  "id",
  "name",
  "brand",
  "year",
  "sport",
  "gloveType",
  "positionTags",
  "throwHandAvailability",
  "sizeInches",
  "patternType",
  "webType",
  "pocketDepth",
  "fitProfile",
  "wristOpening",
  "handStallWidth",
  "easyClose",
  "stiffness",
  "breakInTime",
  "leatherQuality",
  "durabilityScore",
  "gameReadyLevel",
  "transferSpeedBias",
  "catchSecurity",
  "versatilityScore",
  "youthFriendly",
  "fastpitchFit",
  "slowpitchFriendly",
  "price",
  "msrp",
  "inProduction",
  "lastVerified",
  "purchaseLinks",
  "status",
] as const;

/**
 * Subjective scoring fields. We NEVER auto-fill these — they are
 * deliberately blank on append and the row carries `inProduction=false`
 * until a human review pass fills them in.
 */
const SCORING_FIELDS = [
  "leatherQuality",
  "durabilityScore",
  "stiffness",
  "breakInTime",
  "easyClose",
  "gameReadyLevel",
  "pocketDepth",
  "fitProfile",
  "wristOpening",
  "handStallWidth",
  "transferSpeedBias",
  "catchSecurity",
  "versatilityScore",
  "patternType", // patternType is too easy to mis-infer; leave blank for review.
] as const;

const VALID_WEB_TYPES = new Set([
  "i_web",
  "h_web",
  "basket",
  "closed",
  "trap",
  "modified_trap",
  "single_post",
  "two_piece_closed",
  "unsure",
]);

const VALID_POSITIONS = new Set([
  "infield",
  "outfield",
  "pitcher",
  "catcher",
  "first_base",
  "utility",
]);

// ─── CLI flags ────────────────────────────────────────────────────────────────

interface CliFlags {
  dryRun: boolean;
  delayMs: number;
  maxCandidates?: number;
  onlySport?: DiscoverSport;
}

function parseFlags(argv: string[]): CliFlags {
  const f: CliFlags = {
    dryRun: process.env.LIVE_UPDATE !== "true",
    delayMs: 1000,
  };
  for (const a of argv) {
    if (a === "--dry-run") f.dryRun = true;
    else if (a === "--live") f.dryRun = false;
    else if (a.startsWith("--max-candidates=")) f.maxCandidates = parseInt(a.split("=")[1], 10);
    else if (a.startsWith("--only-sport=")) {
      const s = a.split("=")[1] as DiscoverSport;
      if (s === "baseball" || s === "fastpitch" || s === "slowpitch") f.onlySport = s;
    } else if (a.startsWith("--delay-ms=")) f.delayMs = parseInt(a.split("=")[1], 10);
  }
  return f;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function repoRoot(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, "..");
  } catch {
    return process.cwd();
  }
}

function maskKey(s: string | undefined): string {
  if (!s) return "(unset)";
  if (s.length < 12) return "***";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

/**
 * Build the deterministic id used in column `id`, matching the existing
 * catalog convention: `<brand_lower>-<sku_lower>-<sport>` collapsed to
 * what the catalog actually uses — the rows we audited use either
 * `<brand>-<model>` or `<brand>-<year>-<model>`. We use the same shape
 * (brand-year-model when year is known, else brand-model) and fall back
 * to brand-modelFromName when nothing else is available.
 */
function buildCatalogId(parsed: ParsedProduct, sku: string | undefined): string {
  const brand = (parsed.brand ?? "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const year = parsed.year;
  const model =
    sku || productModelFromName(parsed.productName) || parsed.productId || "unknown";
  const cleanModel = model.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (year) return `${brand}-${year}-${cleanModel}`;
  return `${brand}-${cleanModel}`;
}

function deriveFlags(parsed: ParsedProduct): {
  youthFriendly: boolean;
  fastpitchFit: boolean;
  slowpitchFriendly: boolean;
} {
  const blob = `${parsed.productName ?? ""}`.toLowerCase();
  const youthFriendly = /\byouth\b|\bjr\.?\b|\bjunior\b|\bprospect\b/.test(blob);
  const fastpitchFit = parsed.sport === "fastpitch" || /\bfastpitch\b/.test(blob);
  const slowpitchFriendly = parsed.sport === "slowpitch" || /\bslowpitch\b|\bslow[-\s]pitch\b/.test(blob);
  return { youthFriendly, fastpitchFit, slowpitchFriendly };
}

// ─── Report types ─────────────────────────────────────────────────────────────

interface ReportTotals {
  jbgListingsScanned: number;
  candidatesAfterFilter: number;
  duplicatesSkipped: number;
  appended: number;
  review: number;
  errors: number;
}

interface AppendedEntry {
  id: string;
  name: string;
  brand: string;
  sport: string;
  sku: string;
  url: string;
  price: number;
  msrp: number;
  scoringFieldsBlank: string[];
}

interface ReviewEntry {
  id: string;
  name: string;
  brand: string;
  url: string;
  issue:
    | "missing_product_id"
    | "no_brand_match"
    | "webtype_unknown"
    | "excluded_by_regex"
    | "duplicate"
    | "fetch_failed"
    | "missing_required_field"
    | "other";
  candidatePayload: Record<string, unknown>;
  confidence: "low" | "medium" | "high";
}

interface RunReport {
  runStartedAt: string;
  mode: "dry-run" | "live";
  totals: ReportTotals;
  appended: AppendedEntry[];
  review: ReviewEntry[];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const flags = parseFlags(process.argv.slice(2));
  const mode = flags.dryRun ? "dry-run" : "live";

  console.log(`[discover] mode=${mode} delay=${flags.delayMs}ms`);

  // ── Sheets read (config + schema check first; abort on any miss) ─────────
  const cfg = loadSheetsConfig();
  console.log(
    `[discover] sheets: id=${maskKey(cfg.spreadsheetId)} sa=${cfg.clientEmail} tab="${cfg.tabName}"`,
  );
  const sheets = buildSheetsClient(cfg);
  const table = await readCatalogTable(sheets, cfg, REQUIRED_COLUMNS);
  console.log(
    `[discover] read ${table.rows.length} catalog rows; format=` +
    `bool=${table.format.booleanCasing} multi="${table.format.multiDelim}"`,
  );

  // ── Build dedupe index ──────────────────────────────────────────────────
  const index = buildCatalogIndex(table.rows);
  console.log(
    `[discover] dedupe index: ${index.productIds.size} product IDs, ` +
    `${index.skus.size} SKUs, ${index.brandModelPairs.size} brand/model pairs, ` +
    `${index.brands.size} brands`,
  );

  // ── Discover candidates from listings ──────────────────────────────────
  const sports: DiscoverSport[] = flags.onlySport
    ? [flags.onlySport]
    : ["baseball", "fastpitch", "slowpitch"];
  const discovery = await discoverNewListings({
    knownProductIds: index.productIds,
    delayMs: flags.delayMs,
    sports,
  });
  console.log(
    `[discover] listings scanned: ${discovery.stats.pagesScanned} pages, ` +
    `${discovery.stats.listingCardsSeen} cards, ` +
    `${discovery.stats.excludedByRegex} excluded by regex, ` +
    `${discovery.stats.earlyTerminations} sport early-terminations`,
  );

  let candidates = discovery.candidates;
  if (flags.maxCandidates) candidates = candidates.slice(0, flags.maxCandidates);

  // ── Inspect each candidate's product page ──────────────────────────────
  const totals: ReportTotals = {
    jbgListingsScanned: discovery.stats.listingCardsSeen,
    candidatesAfterFilter: 0,
    duplicatesSkipped: 0,
    appended: 0,
    review: 0,
    errors: 0,
  };
  const appended: AppendedEntry[] = [];
  const review: ReviewEntry[] = [];
  const appendCellsBatch: AppendCells[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    if (i > 0) await sleep(flags.delayMs);

    process.stdout.write(
      `[discover] (${i + 1}/${candidates.length}) [${cand.sport}] ${cand.url} … `,
    );

    // Exclusion regex (also re-checked here defensively).
    const cardName = cand.listingName ?? "";
    if (cand.excludedByRegex || EXCLUSION_RE.test(cardName)) {
      console.log("excluded (regex)");
      totals.review++;
      review.push({
        id: "(unfetched)",
        name: cardName,
        brand: "(unknown)",
        url: cand.url,
        issue: "excluded_by_regex",
        candidatePayload: { sport: cand.sport, productId: cand.productId, page: cand.pageNumber },
        confidence: "high",
      });
      continue;
    }

    let parsed: ParsedProduct;
    try {
      parsed = await inspectJbgProduct(cand.url);
    } catch (err) {
      console.log(`fatal parse error: ${(err as Error).message}`);
      totals.errors++;
      review.push({
        id: "(unfetched)",
        name: cardName,
        brand: "(unknown)",
        url: cand.url,
        issue: "fetch_failed",
        candidatePayload: { error: (err as Error).message, sport: cand.sport },
        confidence: "low",
      });
      continue;
    }

    if (parsed.fetchError) {
      console.log(`fetch error: ${parsed.fetchError}`);
      totals.errors++;
      review.push({
        id: "(unfetched)",
        name: parsed.productName ?? cardName,
        brand: parsed.brand ?? "(unknown)",
        url: cand.url,
        issue: "fetch_failed",
        candidatePayload: { httpStatus: parsed.httpStatus, error: parsed.fetchError, sport: cand.sport },
        confidence: "low",
      });
      continue;
    }

    // Affiliate URL must contain the numeric ID — otherwise skip+log.
    const affiliateUrl = parsed.affiliateUrl ?? canonicalAffiliateUrl(cand.url);
    if (!affiliateUrl) {
      console.log("missing numeric product ID — review");
      totals.review++;
      review.push({
        id: "(unfetched)",
        name: parsed.productName ?? cardName,
        brand: parsed.brand ?? "(unknown)",
        url: cand.url,
        issue: "missing_product_id",
        candidatePayload: { sport: cand.sport, parsed: stripParsedForReview(parsed) },
        confidence: "high",
      });
      continue;
    }

    // Sport gate — drop candidates we can't classify into one of the 3 sports.
    const sport = parsed.sport ?? cand.sport;
    if (!sport || (sport !== "baseball" && sport !== "fastpitch" && sport !== "slowpitch")) {
      console.log("no sport — review");
      totals.review++;
      review.push({
        id: "(unfetched)",
        name: parsed.productName ?? cardName,
        brand: parsed.brand ?? "(unknown)",
        url: cand.url,
        issue: "missing_required_field",
        candidatePayload: { sport_inferred: parsed.sport, listing_sport: cand.sport },
        confidence: "medium",
      });
      continue;
    }

    // Dedupe.
    const sku = parsed.productId; // we use the numeric ID as a strong signal
    const candidateKey: Candidate = {
      productId: parsed.productId,
      urlSlug: parsed.urlSlug,
      brand: parsed.brand?.toLowerCase(),
      model: productModelFromName(parsed.productName),
    };
    const dupe = isDuplicate(candidateKey, index);
    if (dupe.isDuplicate) {
      console.log(`duplicate (${dupe.matchedBy})`);
      totals.duplicatesSkipped++;
      continue;
    }

    // Brand gate — we want the brand to match the known brand list, OR
    // the parsed brand to be reasonable (>=2 chars). If we have nothing,
    // skip+log.
    if (!parsed.brand) {
      console.log("no brand — review");
      totals.review++;
      review.push({
        id: "(unfetched)",
        name: parsed.productName ?? cardName,
        brand: "(unknown)",
        url: cand.url,
        issue: "no_brand_match",
        candidatePayload: { sport, parsed: stripParsedForReview(parsed) },
        confidence: "low",
      });
      continue;
    }

    // Required-field gate.
    if (!parsed.productName || !parsed.sizeInches) {
      console.log("missing required field — review");
      totals.review++;
      review.push({
        id: "(unfetched)",
        name: parsed.productName ?? cardName,
        brand: parsed.brand,
        url: cand.url,
        issue: "missing_required_field",
        candidatePayload: { missing: parsed.notes, parsed: stripParsedForReview(parsed) },
        confidence: "medium",
      });
      continue;
    }

    totals.candidatesAfterFilter++;

    // ── Build append payload (field-fill policy from spec) ────────────────
    const id = buildCatalogId(parsed, sku);
    const positionTags = (parsed.positionTags ?? []).filter((p) => VALID_POSITIONS.has(p));
    const throwHand = parsed.throwHandAvailability ?? "RHT";
    const webType = parsed.webType && VALID_WEB_TYPES.has(parsed.webType) ? parsed.webType : "";
    const flagsDerived = deriveFlags(parsed);
    const year = parsed.year ?? new Date().getUTCFullYear();
    const today = todayIso();

    const cells: AppendCells = {
      id,
      name: parsed.productName,
      brand: parsed.brand,
      year,
      sport,
      gloveType: parsed.gloveType ?? "fielding",
      positionTags: positionTags.join(table.format.multiDelim || "|"),
      throwHandAvailability: throwHand,
      sizeInches: parsed.sizeInches,
      // patternType deliberately blank — too easy to mis-infer.
      patternType: "",
      webType,
      pocketDepth: "",
      fitProfile: "",
      wristOpening: "",
      handStallWidth: "",
      easyClose: "",
      stiffness: "",
      breakInTime: "",
      leatherQuality: "",
      durabilityScore: "",
      gameReadyLevel: "",
      transferSpeedBias: "",
      catchSecurity: "",
      versatilityScore: "",
      youthFriendly: flagsDerived.youthFriendly,
      fastpitchFit: flagsDerived.fastpitchFit,
      slowpitchFriendly: flagsDerived.slowpitchFriendly,
      price: parsed.price ?? "",
      msrp:
        parsed.msrp && parsed.price && parsed.msrp > parsed.price
          ? parsed.msrp
          : "",
      inProduction: false, // hardcoded — review pass flips it.
      lastVerified: today,
      purchaseLinks: affiliateUrl,
      status: "draft",
    };

    appendCellsBatch.push(cells);
    appended.push({
      id,
      name: parsed.productName,
      brand: parsed.brand,
      sport,
      sku: sku ?? "",
      url: affiliateUrl,
      price: typeof parsed.price === "number" ? parsed.price : 0,
      msrp: typeof parsed.msrp === "number" ? parsed.msrp : 0,
      scoringFieldsBlank: [...SCORING_FIELDS],
    });
    totals.appended++;
    console.log(`queued: id=${id} sport=${sport}`);
  }

  // ── Write to sheet ──────────────────────────────────────────────────────
  if (appendCellsBatch.length === 0) {
    console.log("[discover] no rows to append");
  } else if (flags.dryRun) {
    console.log(`[discover] DRY RUN — would append ${appendCellsBatch.length} rows (skipping)`);
  } else {
    console.log(`[discover] appending ${appendCellsBatch.length} rows …`);
    // Append-only — uses values.append + INSERT_ROWS in sheets-client.
    const res = await appendRows(sheets, cfg, table, appendCellsBatch);
    console.log(`[discover] appended ${res.appendedRows} rows; range=${res.updatedRange ?? "?"}`);
  }

  // ── Build + save report ────────────────────────────────────────────────
  const report: RunReport = {
    runStartedAt: startedAt,
    mode,
    totals,
    appended,
    review,
  };

  const { jsonPath, mdPath } = writeReports(repoRoot(), report);
  console.log(`[discover] wrote ${jsonPath}`);
  console.log(`[discover] wrote ${mdPath}`);
  console.log(
    `[discover] done — appended=${totals.appended} duplicates=${totals.duplicatesSkipped} ` +
    `review=${totals.review} errors=${totals.errors}`,
  );
}

function stripParsedForReview(parsed: ParsedProduct): Record<string, unknown> {
  return {
    productName: parsed.productName,
    brand: parsed.brand,
    sport: parsed.sport,
    gloveType: parsed.gloveType,
    sizeInches: parsed.sizeInches,
    throwHandAvailability: parsed.throwHandAvailability,
    webType: parsed.webType,
    price: parsed.price,
    msrp: parsed.msrp,
    availability: parsed.availability,
    parseConfidence: parsed.parseConfidence,
    productId: parsed.productId,
    urlSlug: parsed.urlSlug,
    notes: parsed.notes,
  };
}

function writeReports(repoRoot: string, report: RunReport): { jsonPath: string; mdPath: string } {
  const dir = path.join(repoRoot, "reports");
  fs.mkdirSync(dir, { recursive: true });
  const date = report.runStartedAt.slice(0, 10);
  const jsonPath = path.join(dir, `glove-discover-${date}.json`);
  const mdPath = path.join(dir, `glove-discover-${date}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");
  fs.writeFileSync(mdPath, renderMarkdown(report), "utf-8");

  return { jsonPath, mdPath };
}

function renderMarkdown(report: RunReport): string {
  const t = report.totals;
  const bySport: Record<string, AppendedEntry[]> = { baseball: [], fastpitch: [], slowpitch: [] };
  for (const a of report.appended) {
    (bySport[a.sport] ??= []).push(a);
  }

  const lines: string[] = [];
  lines.push(`# Kip It Real — JBG New-Glove Discovery — ${report.runStartedAt.slice(0, 10)}`);
  lines.push("");
  lines.push(`**Mode:** ${report.mode}`);
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`| --- | ---: |`);
  lines.push(`| JBG listings scanned | ${t.jbgListingsScanned} |`);
  lines.push(`| Candidates after filter | ${t.candidatesAfterFilter} |`);
  lines.push(`| Duplicates skipped | ${t.duplicatesSkipped} |`);
  lines.push(`| Appended (inProduction=false) | ${t.appended} |`);
  lines.push(`| Manual review queue | ${t.review} |`);
  lines.push(`| Fetch / parse errors | ${t.errors} |`);
  lines.push("");

  if (report.appended.length > 0) {
    lines.push("## Appended IDs (grouped by sport)");
    lines.push("");
    for (const sport of ["baseball", "fastpitch", "slowpitch"] as const) {
      const list = bySport[sport] ?? [];
      if (list.length === 0) continue;
      lines.push(`### ${sport} (${list.length})`);
      lines.push("");
      for (const a of list) {
        lines.push(`- \`${a.id}\` — ${escapeMd(a.name)} ([JBG](${a.url}))`);
      }
      lines.push("");
    }
  }

  if (report.review.length > 0) {
    lines.push("## Review queue");
    lines.push("");
    lines.push(`| Issue | Name | Brand | URL |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const r of report.review.slice(0, 80)) {
      lines.push(
        `| ${r.issue} | ${escapeMd(r.name)} | ${escapeMd(r.brand)} | [link](${r.url}) |`,
      );
    }
    if (report.review.length > 80) {
      lines.push("");
      lines.push(`_…and ${report.review.length - 80} more — see the JSON report._`);
    }
    lines.push("");
  }

  lines.push(
    "_Every appended row has `inProduction=false` and all scoring fields blank — " +
    "they stay invisible to the app until a human/Claude review pass fills the " +
    "scoring fields and flips `inProduction=true`._",
  );
  lines.push("");

  return lines.join("\n");
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

main().catch((err) => {
  console.error("[discover] FATAL:", err);
  process.exit(1);
});
