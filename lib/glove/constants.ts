/**
 * Kip It Real — shared constants, scale bounds, and enum helpers.
 *
 * All numeric scales used across the system are documented here.
 * Scoring and explain logic should import bounds from this file
 * rather than hardcoding magic numbers.
 */

import type { SportType, PositionType, WebPreference } from "./types";

// ─── Numeric scale bounds ─────────────────────────────────────────────────────

/** Pocket depth scale: -2 (very shallow) → +3 (very deep) */
export const POCKET_DEPTH = { MIN: -2, MAX: 3, MID: 0 } as const;

/** Fit profile scale: -2 (very snug) → +3 (very roomy) */
export const FIT_PROFILE = { MIN: -2, MAX: 3, MID: 0 } as const;

/** Easy-close scale: -2 (very stiff close) → +3 (instant close) */
export const EASY_CLOSE = { MIN: -2, MAX: 3, MID: 0 } as const;

/** Stiffness scale: 0 (already broken in) → 5 (raw premium leather) */
export const STIFFNESS = { MIN: 0, MAX: 5 } as const;

/** Break-in time scale: 0 (game-ready) → 5 (months of conditioning) */
export const BREAK_IN = { MIN: 0, MAX: 5 } as const;

/** Leather quality scale: 1 (entry-level synthetic) → 5 (top-tier full-grain) */
export const LEATHER_QUALITY = { MIN: 1, MAX: 5 } as const;

/** Durability, gameReadyLevel, catchSecurity, versatilityScore: 0 → 5 */
export const SCORE_SCALE = { MIN: 0, MAX: 5 } as const;

/**
 * Transfer speed bias: -2 (deep/secure, slow transfer) → +3 (quick transfer)
 * A positive value rewards infielders who want fast hands; negative rewards
 * outfielders / catchers who prioritize catch security.
 */
export const TRANSFER_BIAS = { MIN: -2, MAX: 3, MID: 0 } as const;

/** Budget fallback when player skips the budget step */
export const DEFAULT_BUDGET_MIN = 0;
export const DEFAULT_BUDGET_MAX = 400;

/** Maximum score a glove can receive before normalisation to 0-100 */
export const MAX_RAW_SCORE = 100;

// ─── Position → position family mapping ──────────────────────────────────────

/**
 * Positions that share similar scoring dimensions.
 * Used by explain.ts to generate position-aware copy.
 */
export const INFIELD_POSITIONS: PositionType[] = [
  "infield",
  "pitcher",
  "utility",
];
export const OUTFIELD_POSITIONS: PositionType[] = ["outfield"];
export const MITT_POSITIONS: PositionType[] = ["catcher", "first_base"];

/** Human-readable labels for position tags. */
export const POSITION_LABELS: Record<PositionType, string> = {
  infield: "Infield",
  outfield: "Outfield",
  pitcher: "Pitcher",
  catcher: "Catcher",
  first_base: "First Base",
  utility: "Utility",
};

/** Human-readable labels for sports. */
export const SPORT_LABELS: Record<SportType, string> = {
  baseball: "Baseball",
  fastpitch: "Fastpitch Softball",
  slowpitch: "Slowpitch Softball",
};

// ─── Web type metadata ────────────────────────────────────────────────────────

export interface WebTypeMeta {
  label: string;
  /** Positions this web is most commonly used for */
  bestFor: PositionType[];
  /** Quick description for explain.ts copy */
  description: string;
}

export const WEB_TYPE_META: Record<WebPreference, WebTypeMeta> = {
  i_web: {
    label: "I-Web",
    bestFor: ["infield", "pitcher"],
    description: "open web that promotes quick transfers",
  },
  h_web: {
    label: "H-Web",
    bestFor: ["infield", "outfield", "utility"],
    description: "versatile open web for infield and outfield crossover",
  },
  basket: {
    label: "Basket Web",
    bestFor: ["utility", "pitcher", "infield"],
    description: "enclosed basket that provides pocket stability",
  },
  closed: {
    label: "Closed Web",
    bestFor: ["pitcher", "catcher"],
    description: "fully closed web that hides grip and sign reading",
  },
  trap: {
    label: "Trap Web",
    bestFor: ["outfield", "utility"],
    description: "large trap web suited for outfield range gloves",
  },
  modified_trap: {
    label: "Modified Trap",
    bestFor: ["outfield", "utility", "infield"],
    description: "trap web variant that blends outfield depth with flexibility",
  },
  single_post: {
    label: "Single Post",
    bestFor: ["first_base"],
    description: "single-post web common on first base mitts",
  },
  two_piece_closed: {
    label: "Two-Piece Closed",
    bestFor: ["pitcher", "infield"],
    description: "two-piece closed web that offers stability and grip hiding",
  },
  unsure: {
    label: "Not Sure",
    bestFor: ["utility"],
    description: "no web preference specified",
  },
};

// ─── Brand list (source of truth for quiz and admin) ─────────────────────────

export const KNOWN_BRANDS = [
  "44 Pro",
  "Akadema",
  "All Star",
  "Easton",
  "Franklin",
  "Kelley",
  "Louisville Slugger",
  "Marucci",
  "Miken",
  "Mizuno",
  "Nokona",
  "Rawlings",
  "Regent",
  "SSK",
  "Under Armour",
  "Vinci",
  "Wilson",
  "Worth",
  "Xanax",
] as const;

export type KnownBrand = (typeof KNOWN_BRANDS)[number];
