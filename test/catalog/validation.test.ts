import { describe, it, expect } from "vitest";
import { validateGloveRow, validateBatch } from "@/lib/catalog/validation";

// ─── Minimal valid row ────────────────────────────────────────────────────────

const VALID_ROW: Record<string, unknown> = {
  id: "rawlings-hoh-11-75-infield",
  name: "Rawlings Heart of the Hide 11.75 Infield",
  brand: "Rawlings",
  year: "2025",
  sport: "baseball",
  gloveType: "fielding",
  positionTags: "infield|pitcher",
  throwHandAvailability: "RHT|LHT",
  sizeInches: "11.75",
  patternType: "infield",
  webType: "i_web",
  pocketDepth: "2",
  fitProfile: "2",
  wristOpening: "2",
  handStallWidth: "2",
  easyClose: "2",
  stiffness: "4",
  breakInTime: "4",
  leatherQuality: "5",
  durabilityScore: "5",
  gameReadyLevel: "2",
  transferSpeedBias: "-1",
  catchSecurity: "3",
  versatilityScore: "3",
  youthFriendly: "false",
  fastpitchFit: "false",
  slowpitchFriendly: "false",
  price: "299",
  msrp: "329",
  inProduction: "true",
  lastVerified: "2026-04-14",
  descriptionShort: "Premium infield glove.",
  notes: "Best for advanced players.",
  purchaseLinks: "Example Retailer::https://example.com/glove",
  status: "published",
};

// ─── validateGloveRow ────────────────────────────────────────────────────────

describe("validateGloveRow", () => {
  it("passes a fully valid row", () => {
    const result = validateGloveRow(VALID_ROW);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.product).toBeDefined();
  });

  it("correctly coerces string numbers to numbers", () => {
    const result = validateGloveRow(VALID_ROW);
    expect(result.product?.price).toBe(299);
    expect(result.product?.sizeInches).toBe(11.75);
    expect(result.product?.transferSpeedBias).toBe(-1);
  });

  it("correctly coerces string booleans", () => {
    const result = validateGloveRow(VALID_ROW);
    expect(result.product?.youthFriendly).toBe(false);
    expect(result.product?.inProduction).toBe(true);
  });

  it("parses pipe-delimited positionTags", () => {
    const result = validateGloveRow(VALID_ROW);
    expect(result.product?.positionTags).toEqual(["infield", "pitcher"]);
  });

  it("parses pipe-delimited throwHandAvailability", () => {
    const result = validateGloveRow(VALID_ROW);
    expect(result.product?.throwHandAvailability).toEqual(["RHT", "LHT"]);
  });

  it("parses purchaseLinks with :: separator", () => {
    const result = validateGloveRow(VALID_ROW);
    expect(result.product?.purchaseLinks).toHaveLength(1);
    expect(result.product?.purchaseLinks?.[0].retailer).toBe("Example Retailer");
    expect(result.product?.purchaseLinks?.[0].url).toBe(
      "https://example.com/glove",
    );
  });

  it("parses multiple purchaseLinks separated by pipe", () => {
    const row = {
      ...VALID_ROW,
      purchaseLinks:
        "Retailer A::https://a.com|Retailer B::https://b.com",
    };
    const result = validateGloveRow(row);
    expect(result.product?.purchaseLinks).toHaveLength(2);
    expect(result.product?.purchaseLinks?.[1].retailer).toBe("Retailer B");
  });

  it("returns empty purchaseLinks for empty string", () => {
    const row = { ...VALID_ROW, purchaseLinks: "" };
    const result = validateGloveRow(row);
    expect(result.product?.purchaseLinks).toEqual([]);
  });

  it("omits msrp when field is empty", () => {
    const row = { ...VALID_ROW, msrp: "" };
    const result = validateGloveRow(row);
    expect(result.product?.msrp).toBeUndefined();
  });

  // ── Failure cases ─────────────────────────────────────────────────────────

  it("fails when id is missing", () => {
    const row = { ...VALID_ROW, id: "" };
    const result = validateGloveRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("id"))).toBe(true);
  });

  it("fails when name is missing", () => {
    const row = { ...VALID_ROW, name: "" };
    const result = validateGloveRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("name"))).toBe(true);
  });

  it("fails for an invalid sport", () => {
    const row = { ...VALID_ROW, sport: "cricket" };
    const result = validateGloveRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("sport"))).toBe(true);
  });

  it("fails for an invalid gloveType", () => {
    const row = { ...VALID_ROW, gloveType: "batting_glove" };
    const result = validateGloveRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("gloveType"))).toBe(true);
  });

  it("fails for an invalid webType", () => {
    const row = { ...VALID_ROW, webType: "spider_web" };
    const result = validateGloveRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("webType"))).toBe(true);
  });

  it("fails when positionTags contains invalid positions", () => {
    const row = { ...VALID_ROW, positionTags: "shortstop|centerfield" };
    const result = validateGloveRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("positionTags"))).toBe(true);
  });

  it("fails when positionTags is empty", () => {
    const row = { ...VALID_ROW, positionTags: "" };
    const result = validateGloveRow(row);
    expect(result.valid).toBe(false);
  });

  it("fails when price is not a number", () => {
    const row = { ...VALID_ROW, price: "three hundred" };
    const result = validateGloveRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("price"))).toBe(true);
  });

  it("fails when leatherQuality is out of range", () => {
    const row = { ...VALID_ROW, leatherQuality: "7" };
    const result = validateGloveRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("leatherQuality"))).toBe(true);
  });

  it("fails when boolean field is not true/false", () => {
    const row = { ...VALID_ROW, youthFriendly: "yes" };
    const result = validateGloveRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("youthFriendly"))).toBe(true);
  });

  it("collects all errors before returning (no fail-fast)", () => {
    const row = {
      ...VALID_ROW,
      id: "",
      sport: "cricket",
      price: "not-a-number",
    };
    const result = validateGloveRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("flags purchaseLinks with missing :: separator", () => {
    const row = {
      ...VALID_ROW,
      purchaseLinks: "Retailer A at https://a.com",
    };
    const result = validateGloveRow(row);
    // The link is skipped — product may still be valid if everything else is OK
    // but we check that the bad link produced an error
    expect(result.errors.some((e) => e.includes("purchaseLinks"))).toBe(true);
  });
});

// ─── validateBatch ────────────────────────────────────────────────────────────

describe("validateBatch", () => {
  it("separates valid rows from invalid rows", () => {
    const rows = [
      VALID_ROW,
      { ...VALID_ROW, id: "second-glove" },
      { ...VALID_ROW, sport: "invalid", id: "bad-row" },
    ];
    const { valid, invalid } = validateBatch(rows);
    expect(valid).toHaveLength(2);
    expect(invalid).toHaveLength(1);
  });

  it("reports the correct 1-indexed row number (+1 for header) for invalid rows", () => {
    const rows = [
      { ...VALID_ROW, id: "glove-1" },
      { ...VALID_ROW, sport: "invalid", id: "bad" }, // row index 1 → row 3 (1 header + 2)
    ];
    const { invalid } = validateBatch(rows);
    expect(invalid[0].rowIndex).toBe(3); // header + row 1-indexed
  });

  it("returns empty arrays when catalog is empty", () => {
    const { valid, invalid } = validateBatch([]);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(0);
  });
});
