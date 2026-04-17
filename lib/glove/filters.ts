/**
 * Kip It Real — hard and soft filtering pipeline.
 *
 * Hard filters eliminate gloves that categorically cannot match the user.
 * They run first — nothing that fails a hard filter should ever appear in results.
 *
 * Soft filters flag gloves that are a stretch but not impossible.
 * They don't remove gloves; they return context that scoring.ts can use
 * to apply a mild penalty or that explain.ts can surface as a tradeoff.
 *
 * Key invariant: filtering is a pure function of (profile, catalog).
 * No side effects, no async, no state.
 */

import type { UserProfile, GloveProduct, GloveType, PositionType } from "./types";
import { MITT_POSITIONS } from "./constants";

// ─── Hard filter reasons (returned for debugging / explain context) ────────────

export type HardFilterReason =
  | "wrong_sport"
  | "wrong_glove_type"
  | "throw_hand_unavailable"
  | "not_in_production"
  | "mitt_required_not_fielding"
  | "fielding_required_not_mitt";

export interface HardFilterResult {
  passed: boolean;
  reason?: HardFilterReason;
}

// ─── Soft filter flags ────────────────────────────────────────────────────────

export interface SoftFilterFlags {
  overBudget: boolean;
  underBudget: boolean; // price well below min — may feel too cheap
  brandMismatch: boolean;
  secondaryPositionMismatch: boolean;
  fastpitchFitMismatch: boolean; // fastpitch player, non-fastpitch glove
  slowpitchMismatch: boolean;    // slowpitch player, non-slowpitch glove
  youthMismatch: boolean;        // youth player, non-youth-friendly glove
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * The gloveType a given position always requires.
 * Mirrors profile.ts logic — kept separate so filters.ts has no circular dep.
 */
function requiredGloveType(position: PositionType): GloveType {
  if (position === "catcher") return "catcher";
  if (position === "first_base") return "first_base";
  return "fielding";
}

// ─── Hard filter: single glove ────────────────────────────────────────────────

/**
 * Returns whether a glove passes all hard filters for the given profile.
 * Fails fast on the first failing condition.
 */
export function hardFilter(
  profile: UserProfile,
  glove: GloveProduct,
): HardFilterResult {
  // 1. Sport must match exactly.
  if (glove.sport !== profile.sport) {
    return { passed: false, reason: "wrong_sport" };
  }

  // 2. Glove type must match the required type for the player's position.
  const required = requiredGloveType(profile.primaryPosition);

  if (required !== glove.gloveType) {
    // Catcher / first base players must get mitts.
    if (MITT_POSITIONS.includes(profile.primaryPosition)) {
      return { passed: false, reason: "mitt_required_not_fielding" };
    }
    // Fielding players must not get mitts.
    return { passed: false, reason: "fielding_required_not_mitt" };
  }

  // 3. Throw hand must be available.
  if (!glove.throwHandAvailability.includes(profile.throwHand)) {
    return { passed: false, reason: "throw_hand_unavailable" };
  }

  // 4. Must be in production (discontinued gloves are excluded by default).
  if (!glove.inProduction) {
    return { passed: false, reason: "not_in_production" };
  }

  return { passed: true };
}

// ─── Soft filter: single glove ────────────────────────────────────────────────

/**
 * Returns soft-filter flags for a glove.
 * All flags are independently true/false — multiple can fire at once.
 */
export function softFilter(
  profile: UserProfile,
  glove: GloveProduct,
): SoftFilterFlags {
  const overBudget = glove.price > profile.budgetMax;
  // Flag suspiciously cheap — more than 40 % below budget floor when floor > 50
  const underBudget =
    profile.budgetMin > 50 && glove.price < profile.budgetMin * 0.6;

  const brandMismatch =
    Array.isArray(profile.preferredBrands) &&
    profile.preferredBrands.length > 0 &&
    !profile.preferredBrands.includes(glove.brand);

  const secondaryPositionMismatch =
    profile.secondaryPosition !== undefined &&
    !glove.positionTags.includes(profile.secondaryPosition);

  const fastpitchFitMismatch =
    profile.sport === "fastpitch" &&
    profile.fastpitchFitImportant &&
    !glove.fastpitchFit;

  const slowpitchMismatch =
    profile.sport === "slowpitch" && !glove.slowpitchFriendly;

  const youthMismatch =
    profile.ageGroup === "youth" && !glove.youthFriendly;

  return {
    overBudget,
    underBudget,
    brandMismatch,
    secondaryPositionMismatch,
    fastpitchFitMismatch,
    slowpitchMismatch,
    youthMismatch,
  };
}

// ─── Catalog-level filtering ──────────────────────────────────────────────────

export interface FilteredCatalog {
  eligible: GloveProduct[];
  rejected: Array<{ glove: GloveProduct; reason: HardFilterReason }>;
}

/**
 * Splits a full catalog into eligible gloves and rejected gloves.
 * The scoring pipeline only sees `eligible`.
 */
export function filterCatalog(
  profile: UserProfile,
  catalog: GloveProduct[],
): FilteredCatalog {
  const eligible: GloveProduct[] = [];
  const rejected: Array<{ glove: GloveProduct; reason: HardFilterReason }> = [];

  for (const glove of catalog) {
    const result = hardFilter(profile, glove);
    if (result.passed) {
      eligible.push(glove);
    } else {
      rejected.push({ glove, reason: result.reason! });
    }
  }

  return { eligible, rejected };
}

/**
 * Relaxed-filter options. Each flag turns off one of the hard filters so the
 * scoring pipeline can progressively degrade strictness when a strict pass
 * returns zero eligible gloves.
 *
 * Sport + glove type are NEVER relaxed — those are fundamental (an outfielder
 * can't use a catcher's mitt, a fastpitch player needs fastpitch gear).
 */
export interface RelaxedFilterOptions {
  /** Allow gloves marked inProduction=false (discontinued but catalogued). */
  ignoreInProduction?: boolean;
  /** Allow gloves that don't offer the player's throw hand. */
  ignoreThrowHand?: boolean;
}

/**
 * Same contract as hardFilter but with individual filters toggleable off.
 */
export function hardFilterRelaxed(
  profile: UserProfile,
  glove: GloveProduct,
  opts: RelaxedFilterOptions = {},
): HardFilterResult {
  if (glove.sport !== profile.sport) {
    return { passed: false, reason: "wrong_sport" };
  }

  const required = requiredGloveType(profile.primaryPosition);
  if (required !== glove.gloveType) {
    if (MITT_POSITIONS.includes(profile.primaryPosition)) {
      return { passed: false, reason: "mitt_required_not_fielding" };
    }
    return { passed: false, reason: "fielding_required_not_mitt" };
  }

  if (!opts.ignoreThrowHand && !glove.throwHandAvailability.includes(profile.throwHand)) {
    return { passed: false, reason: "throw_hand_unavailable" };
  }

  if (!opts.ignoreInProduction && !glove.inProduction) {
    return { passed: false, reason: "not_in_production" };
  }

  return { passed: true };
}

/**
 * Catalog-level relaxed filter. Used by the ranking fallback when a strict
 * pass returns zero eligible gloves.
 */
export function filterCatalogRelaxed(
  profile: UserProfile,
  catalog: GloveProduct[],
  opts: RelaxedFilterOptions = {},
): FilteredCatalog {
  const eligible: GloveProduct[] = [];
  const rejected: Array<{ glove: GloveProduct; reason: HardFilterReason }> = [];

  for (const glove of catalog) {
    const result = hardFilterRelaxed(profile, glove, opts);
    if (result.passed) {
      eligible.push(glove);
    } else {
      rejected.push({ glove, reason: result.reason! });
    }
  }

  return { eligible, rejected };
}

/**
 * Admin/search helper: filter by one or more catalog attributes without
 * requiring a full UserProfile. Used by the admin dashboard list view.
 */
export interface AdminFilterOptions {
  sport?: GloveProduct["sport"];
  position?: PositionType;
  brand?: string;
  status?: GloveProduct["status"];
  query?: string; // free-text substring match on name
}

export function adminFilter(
  catalog: GloveProduct[],
  opts: AdminFilterOptions,
): GloveProduct[] {
  return catalog.filter((g) => {
    if (opts.sport && g.sport !== opts.sport) return false;
    if (opts.position && !g.positionTags.includes(opts.position)) return false;
    if (opts.brand && g.brand !== opts.brand) return false;
    if (opts.status && g.status !== opts.status) return false;
    if (
      opts.query &&
      !g.name.toLowerCase().includes(opts.query.toLowerCase())
    )
      return false;
    return true;
  });
}
