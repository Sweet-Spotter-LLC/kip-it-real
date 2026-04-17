import { describe, it, expect } from "vitest";
import {
  matchesBrowseFilters,
  sortBrowseGloves,
  uniqueBrands,
  priceBounds,
} from "@/lib/glove/browse";
import {
  BASEBALL_INFIELD_GLOVE,
  BASEBALL_OUTFIELD_GLOVE,
  FASTPITCH_GLOVE,
  SAMPLE_CATALOG,
} from "../fixtures";

describe("matchesBrowseFilters", () => {
  it("returns true when no filters are applied", () => {
    expect(matchesBrowseFilters(BASEBALL_INFIELD_GLOVE, {})).toBe(true);
  });

  it("filters by sport", () => {
    expect(
      matchesBrowseFilters(BASEBALL_INFIELD_GLOVE, { sport: "baseball" }),
    ).toBe(true);
    expect(
      matchesBrowseFilters(FASTPITCH_GLOVE, { sport: "baseball" }),
    ).toBe(false);
  });

  it("filters by position (via positionTags)", () => {
    expect(
      matchesBrowseFilters(BASEBALL_INFIELD_GLOVE, { position: "infield" }),
    ).toBe(true);
    expect(
      matchesBrowseFilters(BASEBALL_OUTFIELD_GLOVE, { position: "infield" }),
    ).toBe(false);
  });

  it("filters by brand", () => {
    expect(
      matchesBrowseFilters(BASEBALL_INFIELD_GLOVE, { brand: "Rawlings" }),
    ).toBe(true);
    expect(
      matchesBrowseFilters(BASEBALL_INFIELD_GLOVE, { brand: "Wilson" }),
    ).toBe(false);
  });

  it("treats 'all' sentinels as no-op", () => {
    expect(
      matchesBrowseFilters(BASEBALL_INFIELD_GLOVE, {
        sport: "all",
        position: "all",
        brand: "all",
      }),
    ).toBe(true);
  });

  it("filters by min/max price", () => {
    expect(
      matchesBrowseFilters(BASEBALL_INFIELD_GLOVE, { minPrice: 500 }),
    ).toBe(false);
    expect(
      matchesBrowseFilters(BASEBALL_INFIELD_GLOVE, { maxPrice: 200 }),
    ).toBe(false);
    expect(
      matchesBrowseFilters(BASEBALL_INFIELD_GLOVE, {
        minPrice: 200,
        maxPrice: 400,
      }),
    ).toBe(true);
  });

  it("filters by substring query on name/brand", () => {
    expect(
      matchesBrowseFilters(BASEBALL_INFIELD_GLOVE, { query: "rawlings" }),
    ).toBe(true);
    expect(
      matchesBrowseFilters(BASEBALL_INFIELD_GLOVE, { query: "wilson" }),
    ).toBe(false);
  });
});

describe("sortBrowseGloves", () => {
  const sample = [
    { ...BASEBALL_INFIELD_GLOVE, id: "a", price: 200, year: 2024 },
    { ...BASEBALL_INFIELD_GLOVE, id: "b", price: 100, year: 2026 },
    { ...BASEBALL_INFIELD_GLOVE, id: "c", price: 350, year: 2025 },
  ];

  it("sorts by price ascending", () => {
    const ids = sortBrowseGloves(sample, "price_asc").map((g) => g.id);
    expect(ids).toEqual(["b", "a", "c"]);
  });

  it("sorts by price descending", () => {
    const ids = sortBrowseGloves(sample, "price_desc").map((g) => g.id);
    expect(ids).toEqual(["c", "a", "b"]);
  });

  it("sorts by newest year", () => {
    const ids = sortBrowseGloves(sample, "newest").map((g) => g.id);
    expect(ids[0]).toBe("b");
  });

  it("sorts by name A→Z", () => {
    const ids = sortBrowseGloves(sample, "name_asc").map((g) => g.name);
    expect(ids[0].localeCompare(ids[1])).toBeLessThanOrEqual(0);
  });
});

describe("uniqueBrands", () => {
  it("returns unique brand names sorted alphabetically", () => {
    const brands = uniqueBrands(SAMPLE_CATALOG);
    const copy = [...brands].sort((a, b) => a.localeCompare(b));
    expect(brands).toEqual(copy);
    expect(new Set(brands).size).toBe(brands.length);
  });
});

describe("priceBounds", () => {
  it("returns [min, max] across the catalog", () => {
    const [min, max] = priceBounds(SAMPLE_CATALOG);
    expect(min).toBeLessThanOrEqual(max);
    for (const g of SAMPLE_CATALOG) {
      expect(g.price).toBeGreaterThanOrEqual(min);
      expect(g.price).toBeLessThanOrEqual(max);
    }
  });

  it("falls back to sensible defaults on empty input", () => {
    expect(priceBounds([])).toEqual([0, 500]);
  });
});
