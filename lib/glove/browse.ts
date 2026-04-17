/**
 * Kip It Real — browse-page filtering & sorting helpers.
 *
 * Pure functions so the /browse client can stay dumb and these can be unit
 * tested in isolation. Kept separate from filters.ts because those functions
 * operate on a UserProfile; these operate on plain UI filter state.
 */

import type { GloveProduct, SportType, PositionType } from "./types";

export interface BrowseFilters {
  sport?: SportType | "all";
  position?: PositionType | "all";
  brand?: string | "all";
  minPrice?: number;
  maxPrice?: number;
  query?: string;
}

export type BrowseSort =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "newest"
  | "name_asc";

export const BROWSE_SORT_OPTIONS: Array<{ value: BrowseSort; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
  { value: "name_asc", label: "Name: A → Z" },
];

/** Return true if `glove` passes every active filter. */
export function matchesBrowseFilters(
  glove: GloveProduct,
  filters: BrowseFilters,
): boolean {
  if (filters.sport && filters.sport !== "all" && glove.sport !== filters.sport) {
    return false;
  }
  if (
    filters.position &&
    filters.position !== "all" &&
    !glove.positionTags.includes(filters.position)
  ) {
    return false;
  }
  if (filters.brand && filters.brand !== "all" && glove.brand !== filters.brand) {
    return false;
  }
  if (typeof filters.minPrice === "number" && glove.price < filters.minPrice) {
    return false;
  }
  if (typeof filters.maxPrice === "number" && glove.price > filters.maxPrice) {
    return false;
  }
  if (filters.query) {
    const q = filters.query.toLowerCase();
    const hay = `${glove.name} ${glove.brand} ${glove.descriptionShort ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** Produce a sorted copy of `gloves` per the chosen sort key. */
export function sortBrowseGloves(
  gloves: GloveProduct[],
  sort: BrowseSort,
): GloveProduct[] {
  const out = [...gloves];
  switch (sort) {
    case "price_asc":
      return out.sort((a, b) => a.price - b.price);
    case "price_desc":
      return out.sort((a, b) => b.price - a.price);
    case "newest":
      return out.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    case "name_asc":
      return out.sort((a, b) => a.name.localeCompare(b.name));
    case "recommended":
    default:
      // Default = in-production first, then newer, then cheaper.
      return out.sort((a, b) => {
        if (a.inProduction !== b.inProduction) return a.inProduction ? -1 : 1;
        if (b.year !== a.year) return (b.year ?? 0) - (a.year ?? 0);
        return a.price - b.price;
      });
  }
}

/** Extract unique brand names from a catalog, alphabetically. */
export function uniqueBrands(gloves: GloveProduct[]): string[] {
  return Array.from(new Set(gloves.map((g) => g.brand))).sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Compute the [min, max] price bounds for slider defaults. */
export function priceBounds(gloves: GloveProduct[]): [number, number] {
  if (gloves.length === 0) return [0, 500];
  let min = Infinity;
  let max = -Infinity;
  for (const g of gloves) {
    if (g.price < min) min = g.price;
    if (g.price > max) max = g.price;
  }
  return [Math.floor(min), Math.ceil(max)];
}
