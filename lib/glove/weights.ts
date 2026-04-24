/**
 * Kip It Real — scoring weight maps.
 *
 * DEFAULT_WEIGHTS is the general-purpose baseline. Sport-specific overrides
 * nudge individual dimensions without touching the core scoring logic.
 *
 * Weights do NOT need to sum to any particular value — scoring.ts normalises
 * the final result to 0–100 after applying them. This means you can bump one
 * weight without manually re-balancing the others.
 *
 * Tuning guidance:
 *  - Raise a weight if the dimension should make-or-break a recommendation.
 *  - Lower a weight if the dimension is a nice-to-have.
 *  - Set to 0 only if the dimension is irrelevant for that sport (rare).
 */

import type { ScoringWeights, SportType } from "./types";

// ─── Baseline weights ─────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: ScoringWeights = {
  /** Core positional match — does this glove actually belong at my position? */
  positionFit: 20,

  /** Is the glove the right size for my age + position? */
  sizeFit: 15,

  /** Does the pocket depth align with my preference? */
  pocketFit: 12,

  /** Does the hand opening feel match what I want? */
  fitProfile: 10,

  /** Can I tolerate how stiff this glove is before game use? */
  breakInFit: 12,

  /** Do I care about leather quality and how does this glove score? */
  leatherQualityFit: 8,

  /** Is the web style what I asked for (or position-appropriate)? */
  webFit: 5,

  /** Does the price fall inside my stated budget? */
  budgetFit: 10,

  /** How versatile is the glove for players who move around? */
  versatilityFit: 4,

  /** Is this glove built for the right sport? (residual after hard filter) */
  sportSpecificFit: 2,

  /** Fastpitch-specific hand-opening importance (fastpitch only) */
  fastpitchFitImportance: 0,

  /** Is the glove appropriate for young hands? (youth only) */
  youthFriendliness: 2,

  /** Value-for-money dimension. Low weight — breaks ties without overpowering fit. */
  valueFit: 3,
};

// ─── Sport-specific overrides ─────────────────────────────────────────────────

/**
 * Baseball weights: full position + size + break-in spectrum.
 * Standard baseline with slightly higher break-in tolerance tracking.
 */
export const BASEBALL_WEIGHTS: ScoringWeights = {
  ...DEFAULT_WEIGHTS,
  positionFit: 22,
  sizeFit: 15,
  pocketFit: 12,
  breakInFit: 13,
  leatherQualityFit: 9,
  budgetFit: 9,
  fastpitchFitImportance: 0,
};

/**
 * Fastpitch weights: fit and hand-opening are more important than baseball.
 * Pocket and web still matter, but fastpitch-specific fit gets meaningful weight.
 */
export const FASTPITCH_WEIGHTS: ScoringWeights = {
  ...DEFAULT_WEIGHTS,
  positionFit: 18,
  sizeFit: 14,
  pocketFit: 11,
  fitProfile: 13,          // hand opening fit matters more in fastpitch
  breakInFit: 10,
  leatherQualityFit: 8,
  budgetFit: 10,
  fastpitchFitImportance: 8, // activates only when fastpitchFitImportant is true
  versatilityFit: 4,
  youthFriendliness: 4,
};

/**
 * Slowpitch weights: catch security and leather quality matter more than
 * baseball; position fit is softer because utility-tagged gloves are common
 * in the slowpitch market and versatility is inferred (not asked).
 */
export const SLOWPITCH_WEIGHTS: ScoringWeights = {
  ...DEFAULT_WEIGHTS,
  positionFit: 14,          // softened from 16 — utility matches now score 0.65
  sizeFit: 12,
  pocketFit: 14,            // catch security / deeper pockets rewarded more
  fitProfile: 8,
  breakInFit: 10,
  leatherQualityFit: 10,    // raised from 6 — leather matters for premium path
  budgetFit: 14,            // price still matters for rec-league context
  versatilityFit: 8,        // inferred from positions, reduced from 10
  sportSpecificFit: 4,
  fastpitchFitImportance: 0,
  youthFriendliness: 2,
};

// ─── Weight resolver ──────────────────────────────────────────────────────────

const SPORT_WEIGHT_MAP: Record<SportType, ScoringWeights> = {
  baseball: BASEBALL_WEIGHTS,
  fastpitch: FASTPITCH_WEIGHTS,
  slowpitch: SLOWPITCH_WEIGHTS,
};

/**
 * Returns the appropriate weight map for a given sport.
 * Falls back to DEFAULT_WEIGHTS if the sport is unrecognised (shouldn't happen).
 */
export function weightsForSport(sport: SportType): ScoringWeights {
  return SPORT_WEIGHT_MAP[sport] ?? DEFAULT_WEIGHTS;
}

/**
 * Allows callers (e.g. tests, a future admin tuning page) to produce a
 * merged weight set without mutating the originals.
 */
export function mergeWeights(
  base: ScoringWeights,
  overrides: Partial<ScoringWeights>,
): ScoringWeights {
  return { ...base, ...overrides };
}
