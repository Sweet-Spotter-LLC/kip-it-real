/**
 * Kip It Real — GloveProduct row validator.
 *
 * Used by two consumers:
 *  1. scripts/sync-glove-catalog.js  — validates parsed CSV rows before writing JSON
 *  2. app/api/admin routes           — validates form payloads before writing to catalog
 *
 * Returns a typed result so callers can handle errors without throwing.
 * No external schema library required — keeps the sync script dependency-free.
 */

import type {
  GloveProduct,
  SportType,
  GloveType,
  PositionType,
  ThrowHand,
  WebPreference,
  CatalogStatus,
  PurchaseLink,
} from "../glove/types";

// ─── Valid value sets ──────────────────────────────────────────────────────────

const VALID_SPORTS: SportType[] = ["baseball", "fastpitch", "slowpitch"];
const VALID_GLOVE_TYPES: GloveType[] = ["fielding", "catcher", "first_base"];
const VALID_POSITIONS: PositionType[] = [
  "infield",
  "outfield",
  "pitcher",
  "catcher",
  "first_base",
  "utility",
];
const VALID_THROW_HANDS: ThrowHand[] = ["RHT", "LHT"];
const VALID_WEB_TYPES: WebPreference[] = [
  "i_web",
  "h_web",
  "basket",
  "closed",
  "trap",
  "modified_trap",
  "single_post",
  "two_piece_closed",
  "unsure",
];
const VALID_PATTERN_TYPES = [
  "infield",
  "outfield",
  "pitcher",
  "utility",
  "softball_specific",
  "catcher",
  "first_base",
] as const;
const VALID_STATUSES: CatalogStatus[] = ["draft", "published"];

// ─── Result type ──────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  product?: GloveProduct;
}

// ─── Coercion helpers ─────────────────────────────────────────────────────────

function asString(v: unknown, field: string, errors: string[]): string {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  errors.push(`${field}: expected non-empty string, got "${v}"`);
  return "";
}

function asNumber(v: unknown, field: string, errors: string[]): number {
  const n = Number(v);
  if (!isNaN(n)) return n;
  errors.push(`${field}: expected number, got "${v}"`);
  return 0;
}

function asBool(v: unknown, field: string, errors: string[]): boolean {
  if (v === true || v === "true" || v === "TRUE" || v === 1) return true;
  if (v === false || v === "false" || v === "FALSE" || v === 0) return false;
  errors.push(`${field}: expected boolean (true/false), got "${v}"`);
  return false;
}

function asEnum<T extends string>(
  v: unknown,
  field: string,
  valid: T[],
  errors: string[],
): T {
  if (typeof v === "string" && (valid as string[]).includes(v)) return v as T;
  errors.push(
    `${field}: expected one of [${valid.join(", ")}], got "${v}"`,
  );
  return valid[0];
}

/**
 * Parses a pipe-delimited string like "infield|pitcher|utility"
 * and validates each segment against an allowed set.
 */
function asPipeArray<T extends string>(
  v: unknown,
  field: string,
  valid: T[],
  errors: string[],
): T[] {
  if (typeof v !== "string" || v.trim() === "") {
    errors.push(`${field}: expected pipe-delimited string, got "${v}"`);
    return [];
  }
  const parts = v
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const invalid = parts.filter((p) => !(valid as string[]).includes(p));
  if (invalid.length > 0) {
    errors.push(
      `${field}: unrecognised values [${invalid.join(", ")}]. Valid: [${valid.join(", ")}]`,
    );
  }
  return parts.filter((p): p is T => (valid as string[]).includes(p));
}

/**
 * Infers a friendly retailer name from a URL's hostname.
 * e.g. "www.justballgloves.com" → "JustBallGloves"
 */
function retailerFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const known: Record<string, string> = {
      "justballgloves.com": "JustBallGloves",
      "amazon.com": "Amazon",
      "dickssportinggoods.com": "Dick's Sporting Goods",
      "baseballsavings.com": "Baseball Savings",
      "baseballmonkey.com": "Baseball Monkey",
      "sportsmansguide.com": "Sportsman's Guide",
      "rawlings.com": "Rawlings",
      "wilson.com": "Wilson",
      "mizuno.com": "Mizuno",
      "akademasports.com": "Akadema",
      "marucci.com": "Marucci",
      "worthsports.com": "Worth Sports",
      "miken.com": "Miken",
      "louisvilleslugger.com": "Louisville Slugger",
    };
    if (known[host]) return known[host];
    // Capitalise the first segment of the domain as a fallback.
    return host.split(".")[0].replace(/^./, (c) => c.toUpperCase());
  } catch {
    return "Retailer";
  }
}

/**
 * Parses purchase links. Supports two formats:
 *
 *   1. Preferred:  "Retailer Name::https://url.com|Other Store::https://url2.com"
 *      Double-colon separates retailer from URL; pipe separates records.
 *
 *   2. Bare URLs:  "https://url.com|https://url2.com"
 *      When no "::" separator is found, the retailer is inferred from the domain.
 *
 * Empty / missing value is fine — returns [].
 */
function parsePurchaseLinks(
  v: unknown,
  field: string,
  errors: string[],
): PurchaseLink[] {
  if (typeof v !== "string" || v.trim() === "") return [];

  const links: PurchaseLink[] = [];
  const records = v.split("|").map((s) => s.trim()).filter(Boolean);

  for (const record of records) {
    const colonIdx = record.indexOf("::");

    if (colonIdx === -1) {
      // Bare URL — infer retailer from domain.
      if (!record.startsWith("http")) {
        errors.push(
          `${field}: link record "${record}" is neither a URL nor a "Retailer::URL" pair`,
        );
        continue;
      }
      links.push({ retailer: retailerFromUrl(record), url: record });
      continue;
    }

    const retailer = record.slice(0, colonIdx).trim();
    const url = record.slice(colonIdx + 2).trim();
    if (!retailer || !url) {
      errors.push(`${field}: link record "${record}" has empty retailer or URL`);
      continue;
    }
    links.push({ retailer, url });
  }

  return links;
}

// ─── Main validator ───────────────────────────────────────────────────────────

/**
 * Validates a raw object (from CSV parse or form submission) and attempts
 * to produce a fully typed GloveProduct.
 *
 * Returns { valid: true, product } on success.
 * Returns { valid: false, errors } on failure — product is undefined.
 *
 * Designed to be fault-tolerant: it collects ALL errors before returning
 * so sync scripts can show complete validation output per row.
 */
export function validateGloveRow(raw: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  // ── Required string fields ──────────────────────────────────────────────────
  const id = asString(raw.id, "id", errors);
  const name = asString(raw.name, "name", errors);
  const brand = asString(raw.brand, "brand", errors);

  // ── Enums ───────────────────────────────────────────────────────────────────
  const sport = asEnum(raw.sport, "sport", VALID_SPORTS, errors);
  const gloveType = asEnum(raw.gloveType, "gloveType", VALID_GLOVE_TYPES, errors);
  const webType = asEnum(raw.webType, "webType", VALID_WEB_TYPES, errors);
  const patternType = asEnum(
    raw.patternType,
    "patternType",
    [...VALID_PATTERN_TYPES],
    errors,
  );
  const status = asEnum(raw.status, "status", VALID_STATUSES, errors);

  // ── Pipe-delimited arrays ───────────────────────────────────────────────────
  const positionTags = asPipeArray(
    raw.positionTags,
    "positionTags",
    VALID_POSITIONS,
    errors,
  );
  const throwHandAvailability = asPipeArray(
    raw.throwHandAvailability,
    "throwHandAvailability",
    VALID_THROW_HANDS,
    errors,
  );

  if (positionTags.length === 0) {
    errors.push("positionTags: must contain at least one valid position");
  }
  if (throwHandAvailability.length === 0) {
    errors.push("throwHandAvailability: must contain at least one value (RHT or LHT)");
  }

  // ── Numbers ─────────────────────────────────────────────────────────────────
  const year = asNumber(raw.year, "year", errors);
  const sizeInches = asNumber(raw.sizeInches, "sizeInches", errors);
  const pocketDepth = asNumber(raw.pocketDepth, "pocketDepth", errors);
  const fitProfile = asNumber(raw.fitProfile, "fitProfile", errors);
  const wristOpening = asNumber(raw.wristOpening, "wristOpening", errors);
  const handStallWidth = asNumber(raw.handStallWidth, "handStallWidth", errors);
  const easyClose = asNumber(raw.easyClose, "easyClose", errors);
  const stiffness = asNumber(raw.stiffness, "stiffness", errors);
  const breakInTime = asNumber(raw.breakInTime, "breakInTime", errors);
  const leatherQuality = asNumber(raw.leatherQuality, "leatherQuality", errors);
  const durabilityScore = asNumber(raw.durabilityScore, "durabilityScore", errors);
  const gameReadyLevel = asNumber(raw.gameReadyLevel, "gameReadyLevel", errors);
  const transferSpeedBias = asNumber(raw.transferSpeedBias, "transferSpeedBias", errors);
  const catchSecurity = asNumber(raw.catchSecurity, "catchSecurity", errors);
  const versatilityScore = asNumber(raw.versatilityScore, "versatilityScore", errors);
  const price = asNumber(raw.price, "price", errors);

  // ── Optional numbers ────────────────────────────────────────────────────────
  const msrp =
    raw.msrp !== undefined && raw.msrp !== ""
      ? asNumber(raw.msrp, "msrp", errors)
      : undefined;

  // ── Booleans ────────────────────────────────────────────────────────────────
  const youthFriendly = asBool(raw.youthFriendly, "youthFriendly", errors);
  const fastpitchFit = asBool(raw.fastpitchFit, "fastpitchFit", errors);
  const slowpitchFriendly = asBool(raw.slowpitchFriendly, "slowpitchFriendly", errors);
  const inProduction = asBool(raw.inProduction, "inProduction", errors);

  // ── Optional booleans ───────────────────────────────────────────────────────
  const crossoverViable =
    raw.crossoverViable !== undefined && raw.crossoverViable !== ""
      ? asBool(raw.crossoverViable, "crossoverViable", errors)
      : undefined;

  // ── Optional strings ────────────────────────────────────────────────────────
  const lastVerified =
    typeof raw.lastVerified === "string" && raw.lastVerified.trim()
      ? raw.lastVerified.trim()
      : undefined;
  const descriptionShort =
    typeof raw.descriptionShort === "string" && raw.descriptionShort.trim()
      ? raw.descriptionShort.trim()
      : undefined;
  const notes =
    typeof raw.notes === "string" && raw.notes.trim()
      ? raw.notes.trim()
      : undefined;

  // ── Purchase links ──────────────────────────────────────────────────────────
  const purchaseLinks = parsePurchaseLinks(
    raw.purchaseLinks,
    "purchaseLinks",
    errors,
  );

  // ── Optional new catalog fields ─────────────────────────────────────────────
  const series =
    typeof raw.series === "string" && raw.series.trim()
      ? raw.series.trim()
      : undefined;

  const valueTier =
    typeof raw.valueTier === "string" && raw.valueTier.trim()
      ? raw.valueTier.trim()
      : undefined;

  const valueScore: number | undefined = (() => {
    if (raw.valueScore === undefined || raw.valueScore === "") return undefined;
    const n = Number(raw.valueScore);
    if (isNaN(n)) return undefined;
    return Math.max(0, Math.min(n, 100));
  })();

  // ── Range sanity checks ─────────────────────────────────────────────────────
  if (price < 0) errors.push("price: must be >= 0");
  if (sizeInches < 9 || sizeInches > 50)
    errors.push(`sizeInches: ${sizeInches} is outside expected range (9–50)`);
  if (leatherQuality < 1 || leatherQuality > 5)
    errors.push(`leatherQuality: ${leatherQuality} must be 1–5`);
  if (stiffness < 0 || stiffness > 5)
    errors.push(`stiffness: ${stiffness} must be 0–5`);

  // ── Result ──────────────────────────────────────────────────────────────────
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const product: GloveProduct = {
    id,
    name,
    brand,
    year,
    sport,
    gloveType,
    positionTags,
    throwHandAvailability,
    sizeInches,
    patternType,
    webType,
    pocketDepth,
    fitProfile,
    wristOpening,
    handStallWidth,
    easyClose,
    stiffness,
    breakInTime,
    leatherQuality,
    durabilityScore,
    gameReadyLevel,
    transferSpeedBias,
    catchSecurity,
    versatilityScore,
    youthFriendly,
    fastpitchFit,
    slowpitchFriendly,
    crossoverViable,
    price,
    msrp,
    inProduction,
    lastVerified,
    descriptionShort,
    notes,
    purchaseLinks,
    status,
    series,
    valueTier,
    valueScore,
  };

  return { valid: true, errors: [], product };
}

/**
 * Batch validator — runs validateGloveRow on every row and returns a summary.
 * Used by the sync script to report results after parsing the full sheet.
 */
export interface BatchValidationResult {
  valid: GloveProduct[];
  invalid: Array<{ rowIndex: number; raw: Record<string, unknown>; errors: string[] }>;
}

export function validateBatch(
  rows: Record<string, unknown>[],
): BatchValidationResult {
  const valid: GloveProduct[] = [];
  const invalid: BatchValidationResult["invalid"] = [];

  rows.forEach((row, i) => {
    const result = validateGloveRow(row);
    if (result.valid && result.product) {
      valid.push(result.product);
    } else {
      invalid.push({ rowIndex: i + 2, raw: row, errors: result.errors }); // +2 for 1-indexed + header row
    }
  });

  return { valid, invalid };
}
