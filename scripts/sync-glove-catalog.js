#!/usr/bin/env node
/**
 * Kip It Real — Google Sheets → JSON catalog sync script.
 *
 * Mirrors the Bat Intentions distribute-*-catalog.js pattern.
 * No external dependencies — uses Node built-ins only (https, fs, path).
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 *   node scripts/sync-glove-catalog.js <SHEETS_URL>
 *
 * Where SHEETS_URL is the published Google Sheets URL in any of these formats:
 *
 *   https://docs.google.com/spreadsheets/d/SHEET_ID/pubhtml?gid=GID&single=true
 *   https://docs.google.com/spreadsheets/d/SHEET_ID/pub?output=csv&gid=GID
 *   https://docs.google.com/spreadsheets/d/e/PUBLISHED_ID/pub?output=csv
 *
 * The script auto-converts any of those to a raw CSV download URL.
 *
 * ─── SHEET REQUIREMENTS ──────────────────────────────────────────────────────
 *
 * Row 1 must contain these column headers (order doesn't matter):
 *
 *   id, name, brand, year, sport, gloveType, positionTags,
 *   throwHandAvailability, sizeInches, patternType, webType,
 *   pocketDepth, fitProfile, wristOpening, handStallWidth,
 *   easyClose, stiffness, breakInTime, leatherQuality, durabilityScore,
 *   gameReadyLevel, transferSpeedBias, catchSecurity, versatilityScore,
 *   youthFriendly, fastpitchFit, slowpitchFriendly, price, msrp,
 *   inProduction, lastVerified, descriptionShort, notes,
 *   purchaseLinks, status
 *
 * Array columns use pipe delimiter:   infield|pitcher|utility
 * Purchase links use :: separator:    Retailer::https://url.com|Other::https://url2.com
 * Booleans:                           true / false
 * Status:                             published / draft
 *
 * Only rows with status = "published" are written to JSON.
 * Rows with status = "draft" are counted and skipped.
 * Rows with validation errors are logged and skipped.
 *
 * ─── OUTPUT ──────────────────────────────────────────────────────────────────
 *
 *   data/gloves/baseball.json
 *   data/gloves/fastpitch.json
 *   data/gloves/slowpitch.json
 *
 * ─── ADD TO package.json ─────────────────────────────────────────────────────
 *
 *   "scripts": {
 *     "sync-catalog": "node scripts/sync-glove-catalog.js"
 *   }
 *
 *   Then run:  npm run sync-catalog <YOUR_SHEETS_URL>
 */

"use strict";

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// ─── Config ───────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data", "gloves");

const SPORT_FILES = {
  baseball: path.join(DATA_DIR, "baseball.json"),
  fastpitch: path.join(DATA_DIR, "fastpitch.json"),
  slowpitch: path.join(DATA_DIR, "slowpitch.json"),
};

const VALID_SPORTS = ["baseball", "fastpitch", "slowpitch"];

// ─── URL normalisation ────────────────────────────────────────────────────────

/**
 * Converts any published Sheets URL into a raw CSV download URL.
 *
 * Handles:
 *  - /pubhtml?gid=GID&single=true   → /export?format=csv&gid=GID
 *  - /pub?output=csv&gid=GID        → passthrough
 *  - /e/PUBID/pub?output=csv        → passthrough
 */
function toCsvUrl(input) {
  // Already a CSV export URL — pass through.
  if (input.includes("output=csv") || input.includes("format=csv")) {
    return input;
  }

  // pubhtml format — convert to export format.
  if (input.includes("/pubhtml")) {
    const url = new URL(input);
    const sheetId = url.pathname.split("/")[3];
    const gid = url.searchParams.get("gid") ?? "0";
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }

  // /pub format without output param.
  if (input.includes("/pub")) {
    const separator = input.includes("?") ? "&" : "?";
    return `${input}${separator}output=csv`;
  }

  throw new Error(
    `Unrecognised Sheets URL format: ${input}\n` +
      `Expected a Google Sheets "Publish to web" URL.`,
  );
}

// ─── HTTP fetch ───────────────────────────────────────────────────────────────

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        // Follow redirects (Sheets sometimes redirects to a CDN URL).
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchUrl(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(
            new Error(`HTTP ${res.statusCode} fetching ${url}`),
          );
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

/**
 * Minimal RFC-4180 CSV parser.
 * Handles quoted fields, embedded commas, and embedded newlines.
 * Returns an array of row arrays (strings).
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
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

  // Final field / row.
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Converts parsed CSV rows into an array of key-value objects,
 * using the first row as headers.
 */
function csvToObjects(rows) {
  if (rows.length < 2) return [];
  const [headers, ...dataRows] = rows;
  const trimmedHeaders = headers.map((h) => h.trim());

  return dataRows
    .filter((row) => row.some((cell) => cell.trim() !== "")) // skip blank rows
    .map((row) => {
      const obj = {};
      trimmedHeaders.forEach((header, i) => {
        obj[header] = (row[i] ?? "").trim();
      });
      return obj;
    });
}

// ─── Row normalisation ────────────────────────────────────────────────────────

function toNumber(v) {
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function toBool(v) {
  if (v === "true" || v === "TRUE" || v === "1") return true;
  if (v === "false" || v === "FALSE" || v === "0") return false;
  return null;
}

function toPipeArray(v) {
  if (!v || v.trim() === "") return [];
  return v.split("|").map((s) => s.trim()).filter(Boolean);
}

function parsePurchaseLinks(v) {
  if (!v || v.trim() === "") return [];
  return v
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((record) => {
      const colonIdx = record.indexOf("::");
      if (colonIdx === -1) return null;
      return {
        retailer: record.slice(0, colonIdx).trim(),
        url: record.slice(colonIdx + 2).trim(),
      };
    })
    .filter(Boolean);
}

/**
 * Validates and coerces a raw CSV row object into a GloveProduct shape.
 * Returns { ok: true, product } or { ok: false, errors: string[] }.
 */
function normaliseRow(raw) {
  const errors = [];

  // ── Required strings ────────────────────────────────────────────────────────
  const id = raw.id?.trim();
  if (!id) errors.push("id: missing");

  const name = raw.name?.trim();
  if (!name) errors.push("name: missing");

  const brand = raw.brand?.trim();
  if (!brand) errors.push("brand: missing");

  // ── Sport ───────────────────────────────────────────────────────────────────
  const sport = raw.sport?.trim();
  if (!VALID_SPORTS.includes(sport)) {
    errors.push(`sport: "${sport}" not in [baseball, fastpitch, slowpitch]`);
  }

  // ── Status ──────────────────────────────────────────────────────────────────
  const status = raw.status?.trim();
  if (!["draft", "published"].includes(status)) {
    errors.push(`status: "${status}" not in [draft, published]`);
  }

  // ── Enums ───────────────────────────────────────────────────────────────────
  const VALID_GLOVE_TYPES = ["fielding", "catcher", "first_base"];
  const gloveType = raw.gloveType?.trim();
  if (!VALID_GLOVE_TYPES.includes(gloveType)) {
    errors.push(`gloveType: "${gloveType}" not in [${VALID_GLOVE_TYPES.join(", ")}]`);
  }

  const VALID_WEB_TYPES = [
    "i_web","h_web","basket","closed","trap",
    "modified_trap","single_post","two_piece_closed","unsure",
  ];
  const webType = raw.webType?.trim();
  if (!VALID_WEB_TYPES.includes(webType)) {
    errors.push(`webType: "${webType}" not in [${VALID_WEB_TYPES.join(", ")}]`);
  }

  const VALID_PATTERN_TYPES = [
    "infield","outfield","pitcher","utility","softball_specific","catcher","first_base",
  ];
  const patternType = raw.patternType?.trim();
  if (!VALID_PATTERN_TYPES.includes(patternType)) {
    errors.push(`patternType: "${patternType}" not in [${VALID_PATTERN_TYPES.join(", ")}]`);
  }

  // ── Pipe arrays ─────────────────────────────────────────────────────────────
  const VALID_POSITIONS = [
    "infield","outfield","pitcher","catcher","first_base","utility",
  ];
  const VALID_THROW_HANDS = ["RHT", "LHT"];

  const positionTags = toPipeArray(raw.positionTags).filter((v) =>
    VALID_POSITIONS.includes(v),
  );
  if (positionTags.length === 0) {
    errors.push("positionTags: must contain at least one valid position");
  }

  const throwHandAvailability = toPipeArray(raw.throwHandAvailability).filter(
    (v) => VALID_THROW_HANDS.includes(v),
  );
  if (throwHandAvailability.length === 0) {
    errors.push("throwHandAvailability: must contain RHT and/or LHT");
  }

  // ── Numbers ─────────────────────────────────────────────────────────────────
  const numFields = [
    "year","sizeInches","pocketDepth","fitProfile","wristOpening",
    "handStallWidth","easyClose","stiffness","breakInTime","leatherQuality",
    "durabilityScore","gameReadyLevel","transferSpeedBias","catchSecurity",
    "versatilityScore","price",
  ];
  const nums = {};
  for (const f of numFields) {
    const n = toNumber(raw[f]);
    if (n === null) errors.push(`${f}: expected number, got "${raw[f]}"`);
    nums[f] = n ?? 0;
  }
  const msrp = raw.msrp?.trim() ? toNumber(raw.msrp) : undefined;

  // ── Booleans ────────────────────────────────────────────────────────────────
  const boolFields = [
    "youthFriendly","fastpitchFit","slowpitchFriendly","inProduction",
  ];
  const bools = {};
  for (const f of boolFields) {
    const b = toBool(raw[f]);
    if (b === null) errors.push(`${f}: expected true/false, got "${raw[f]}"`);
    bools[f] = b ?? false;
  }

  // ── Purchase links ──────────────────────────────────────────────────────────
  const purchaseLinks = parsePurchaseLinks(raw.purchaseLinks);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    product: {
      id,
      name,
      brand,
      year: nums.year,
      sport,
      gloveType,
      positionTags,
      throwHandAvailability,
      sizeInches: nums.sizeInches,
      patternType,
      webType,
      pocketDepth: nums.pocketDepth,
      fitProfile: nums.fitProfile,
      wristOpening: nums.wristOpening,
      handStallWidth: nums.handStallWidth,
      easyClose: nums.easyClose,
      stiffness: nums.stiffness,
      breakInTime: nums.breakInTime,
      leatherQuality: nums.leatherQuality,
      durabilityScore: nums.durabilityScore,
      gameReadyLevel: nums.gameReadyLevel,
      transferSpeedBias: nums.transferSpeedBias,
      catchSecurity: nums.catchSecurity,
      versatilityScore: nums.versatilityScore,
      youthFriendly: bools.youthFriendly,
      fastpitchFit: bools.fastpitchFit,
      slowpitchFriendly: bools.slowpitchFriendly,
      price: nums.price,
      ...(msrp !== undefined && { msrp }),
      inProduction: bools.inProduction,
      ...(raw.lastVerified?.trim() && { lastVerified: raw.lastVerified.trim() }),
      ...(raw.descriptionShort?.trim() && { descriptionShort: raw.descriptionShort.trim() }),
      ...(raw.notes?.trim() && { notes: raw.notes.trim() }),
      purchaseLinks,
      status,
    },
  };
}

// ─── File writer ──────────────────────────────────────────────────────────────

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const inputUrl = process.argv[2];

  if (!inputUrl) {
    console.error(
      "\nUsage: node scripts/sync-glove-catalog.js <GOOGLE_SHEETS_URL>\n\n" +
        "Pass the 'Publish to web' URL from your Google Sheet.\n",
    );
    process.exit(1);
  }

  // ── Resolve CSV URL ─────────────────────────────────────────────────────────
  let csvUrl;
  try {
    csvUrl = toCsvUrl(inputUrl);
  } catch (err) {
    console.error("\n❌", err.message);
    process.exit(1);
  }

  console.log("\n🔄  Fetching catalog from Google Sheets…");
  console.log(`    ${csvUrl}\n`);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  let csvText;
  try {
    csvText = await fetchUrl(csvUrl);
  } catch (err) {
    console.error("❌  Failed to fetch sheet:", err.message);
    process.exit(1);
  }

  // ── Parse ───────────────────────────────────────────────────────────────────
  const rows = parseCsv(csvText);
  const objects = csvToObjects(rows);
  console.log(`📋  Found ${objects.length} data rows (excluding header)\n`);

  // ── Classify ─────────────────────────────────────────────────────────────────
  const byStatus = { published: 0, draft: 0 };
  const byError = [];
  const bySport = { baseball: [], fastpitch: [], slowpitch: [] };

  objects.forEach((raw, idx) => {
    const rowNum = idx + 2; // 1-indexed + header

    // Skip rows where status = draft before full validation.
    if (raw.status?.trim() === "draft") {
      byStatus.draft++;
      return;
    }

    const result = normaliseRow(raw);

    if (!result.ok) {
      byError.push({ rowNum, id: raw.id || "(no id)", errors: result.errors });
      return;
    }

    const { product } = result;
    if (!VALID_SPORTS.includes(product.sport)) {
      byError.push({
        rowNum,
        id: product.id,
        errors: [`sport "${product.sport}" not recognised`],
      });
      return;
    }

    bySport[product.sport].push(product);
    byStatus.published++;
  });

  // ── Write JSON files ─────────────────────────────────────────────────────────
  for (const sport of VALID_SPORTS) {
    const gloves = bySport[sport];
    writeJson(SPORT_FILES[sport], gloves);
    console.log(
      `✅  data/gloves/${sport}.json  →  ${gloves.length} gloves written`,
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────");
  console.log(`  Published  : ${byStatus.published}`);
  console.log(`  Drafts     : ${byStatus.draft}  (skipped)`);
  console.log(`  Errors     : ${byError.length}   (skipped)`);
  console.log("─────────────────────────────────────────\n");

  if (byError.length > 0) {
    console.warn("⚠️   Rows with validation errors (fix in Sheet before next sync):\n");
    for (const { rowNum, id, errors } of byError) {
      console.warn(`  Row ${rowNum} (id: "${id}")`);
      for (const e of errors) {
        console.warn(`    · ${e}`);
      }
      console.warn("");
    }
  }

  if (byError.length > 0) {
    process.exit(1); // non-zero exit so CI pipelines can catch bad data
  }
}

main().catch((err) => {
  console.error("\n💥  Unexpected error:", err);
  process.exit(1);
});
