/**
 * Kip It Real — deterministic glove scoring engine.
 *
 * Architecture:
 *  1. Each dimension produces a sub-score in [0, 1].
 *  2. Sub-scores are multiplied by their weights and summed.
 *  3. The raw sum is normalised to [0, 100] based on the total possible weight.
 *
 * Adding a new dimension:
 *  - Add a scorer function below.
 *  - Add the key to ScoringWeights in types.ts.
 *  - Add a default value to weights.ts.
 *  - Call it inside scoreGlove() and push the breakdown item.
 *  - Done — no other files need changing.
 */

import { WEB_TYPE_META } from "./constants";
import type {
  UserProfile,
  GloveProduct,
  GloveMatchResult,
  ScoreBreakdownItem,
  ScoringWeights,
} from "./types";
import { softFilter, filterCatalog, filterCatalogRelaxed } from "./filters";
import { weightsForSport } from "./weights";
import { generateExplanation } from "./explain";
import {
  POCKET_DEPTH,
  FIT_PROFILE,
  BREAK_IN,
  LEATHER_QUALITY,
  SCORE_SCALE,
  TRANSFER_BIAS,
} from "./constants";

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Clamp a value between min and max, inclusive. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Linear proximity score: 1 when |actual - target| === 0,
 * 0 when |actual - target| >= maxDelta.
 */
function proximitySub(
  actual: number,
  target: number,
  maxDelta: number,
): number {
  const delta = Math.abs(actual - target);
  return clamp(1 - delta / maxDelta, 0, 1);
}

// ─── Individual dimension scorers (all return 0..1) ──────────────────────────

/**
 * Position fit: does the glove's positionTags include the player's primary
 * position? Secondary position match is a bonus.
 */
function scorePositionFit(profile: UserProfile, glove: GloveProduct): number {
  const primaryMatch = glove.positionTags.includes(profile.primaryPosition);
  if (!primaryMatch) return 0;

  const secondaryMatch =
    profile.secondaryPosition &&
    glove.positionTags.includes(profile.secondaryPosition);
  return secondaryMatch ? 1.0 : 0.85;
}

/**
 * Size fit: how close is the glove's size to the recommended range midpoint?
 * Full score if inside the range, graceful degradation outside.
 */
function scoreSizeFit(profile: UserProfile, glove: GloveProduct): number {
  const { recommendedSizeMin: min, recommendedSizeMax: max } = profile;
  const mid = (min + max) / 2;
  const rangeHalf = (max - min) / 2 + 0.25; // add a 0.25" buffer each side
  const size = glove.sizeInches;

  if (size >= min && size <= max) return 1.0;
  return proximitySub(size, mid, rangeHalf * 2);
}

/**
 * Pocket fit: compare glove's pocketDepth to the profile's target.
 * Full scale range is POCKET_DEPTH.MIN..MAX (5-unit span).
 */
function scorePocketFit(profile: UserProfile, glove: GloveProduct): number {
  const span = POCKET_DEPTH.MAX - POCKET_DEPTH.MIN; // 5
  return proximitySub(glove.pocketDepth, profile.pocketDepthTarget, span);
}

/**
 * Fit profile: compare glove's hand opening to the player's fit preference.
 * Full scale range is FIT_PROFILE.MIN..MAX (5-unit span).
 */
function scoreFitProfile(profile: UserProfile, glove: GloveProduct): number {
  const span = FIT_PROFILE.MAX - FIT_PROFILE.MIN; // 5
  return proximitySub(glove.fitProfile, profile.fitTarget, span);
}

/**
 * Break-in fit: compare the player's tolerance to the glove's stiffness.
 * A player who can handle stiff leather (tolerance=5) should not be penalised
 * for a soft glove — only for a glove stiffer than they can tolerate.
 */
function scoreBreakInFit(profile: UserProfile, glove: GloveProduct): number {
  const tolerance = profile.breakInTolerance;
  const stiffness = glove.stiffness;

  // If glove is within tolerance, full score.
  if (stiffness <= tolerance) return 1.0;

  // Penalise proportionally to how much it exceeds tolerance.
  const overage = stiffness - tolerance;
  const maxOverage = BREAK_IN.MAX; // 5
  return clamp(1 - overage / maxOverage, 0, 1);
}

/**
 * Leather quality fit: if the player wants premium leather, reward quality.
 * If not expressed, score neutrally on mid-range quality gloves.
 */
function scoreLeatherQualityFit(
  profile: UserProfile,
  glove: GloveProduct,
): number {
  const q = glove.leatherQuality; // 1..5
  const span = LEATHER_QUALITY.MAX - LEATHER_QUALITY.MIN; // 4

  if (profile.wantsPremiumLeather) {
    // Linear reward for higher quality.
    return (q - LEATHER_QUALITY.MIN) / span;
  }

  if (profile.experienceLevel === "beginner") {
    // Beginners benefit from softer, easier-to-break-in mid-tier leather.
    return proximitySub(q, 3, 2);
  }

  // Neutral: mild preference for quality without forcing premium.
  return proximitySub(q, 4, 3);
}

/**
 * Web fit: direct match if player expressed a preference, otherwise
 * award based on whether the web is positionally appropriate.
 */
function scoreWebFit(profile: UserProfile, glove: GloveProduct): number {
  if (!profile.webPreference) {
    // No preference — check if web is typical for this position.
    const meta = WEB_TYPE_META[glove.webType];
    return meta?.bestFor.includes(profile.primaryPosition) ? 1.0 : 0.6;
  }
  return glove.webType === profile.webPreference ? 1.0 : 0.4;
}

/**
 * Budget fit: full score if at or below budget max.
 * Graceful degradation up to 20 % over, then steep drop.
 */
function scoreBudgetFit(profile: UserProfile, glove: GloveProduct): number {
  const { budgetMax } = profile;
  if (glove.price <= budgetMax) return 1.0;

  const overage = glove.price - budgetMax;
  const softCap = budgetMax * 0.2; // 20 % tolerance
  return clamp(1 - overage / softCap, 0, 1);
}

/**
 * Versatility fit: rewards versatile gloves when the player asked for one.
 * Neutral otherwise (we don't penalise specialised gloves for utility players
 * who didn't flag versatility).
 */
function scoreVersatilityFit(
  profile: UserProfile,
  glove: GloveProduct,
): number {
  if (!profile.wantsVersatility) return 0.7; // neutral baseline
  return glove.versatilityScore / SCORE_SCALE.MAX;
}

/**
 * Sport-specific fit: a residual check after hard filtering.
 * Fastpitch gloves in fastpitch context get a bonus.
 * Slowpitch gloves in slowpitch context get a bonus.
 */
function scoreSportSpecificFit(
  profile: UserProfile,
  glove: GloveProduct,
): number {
  if (profile.sport === "fastpitch" && glove.fastpitchFit) return 1.0;
  if (profile.sport === "slowpitch" && glove.slowpitchFriendly) return 1.0;
  return 0.6; // still in-sport by hard filter — mild penalty for non-dedicated
}

/**
 * Fastpitch fit importance: only meaningfully scored for fastpitch players
 * who flagged hand-opening fit. Rewards gloves with fastpitchFit=true.
 */
function scoreFastpitchFitImportance(
  profile: UserProfile,
  glove: GloveProduct,
): number {
  if (!profile.fastpitchFitImportant) return 1.0; // weight should be 0 for non-FP
  return glove.fastpitchFit ? 1.0 : 0.0;
}

/**
 * Youth friendliness: rewards youthFriendly gloves for youth players.
 */
function scoreYouthFriendliness(
  profile: UserProfile,
  glove: GloveProduct,
): number {
  if (profile.ageGroup !== "youth") return 1.0; // weight should be low for adults
  return glove.youthFriendly ? 1.0 : 0.3;
}

// ─── Soft filter penalties ────────────────────────────────────────────────────

/**
 * Applies a composite multiplicative penalty based on soft filter flags.
 * Maximum combined penalty caps at -25 % of the total score.
 */
function softPenalty(profile: UserProfile, glove: GloveProduct): number {
  const flags = softFilter(profile, glove);
  let penalty = 0;

  if (flags.overBudget) penalty += 0.10;
  if (flags.fastpitchFitMismatch) penalty += 0.08;
  if (flags.slowpitchMismatch) penalty += 0.06;
  if (flags.youthMismatch) penalty += 0.07;
  if (flags.brandMismatch) penalty += 0.04;
  if (flags.secondaryPositionMismatch) penalty += 0.03;
  if (flags.underBudget) penalty += 0.02;

  return clamp(1 - penalty, 0.75, 1.0); // never penalise more than 25 %
}

// ─── Core scorer ──────────────────────────────────────────────────────────────

/**
 * Scores a single glove against a user profile using the given weights.
 * Returns a GloveMatchResult with a 0-100 score and a full breakdown.
 *
 * Explanations are generated lazily in rankGloves; calling scoreGlove
 * directly returns empty reason/tradeoff arrays — call generateExplanation
 * separately if you need them outside the ranking pipeline.
 */
export function scoreGlove(
  profile: UserProfile,
  glove: GloveProduct,
  weights: ScoringWeights,
): Omit<GloveMatchResult, "reasons" | "tradeoffs" | "avoidIf"> & {
  reasons: [];
  tradeoffs: [];
  avoidIf: [];
} {
  type SubScorer = {
    key: keyof ScoringWeights;
    label: string;
    fn: (p: UserProfile, g: GloveProduct) => number;
  };

  const dimensions: SubScorer[] = [
    { key: "positionFit", label: "Position fit", fn: scorePositionFit },
    { key: "sizeFit", label: "Size fit", fn: scoreSizeFit },
    { key: "pocketFit", label: "Pocket depth fit", fn: scorePocketFit },
    { key: "fitProfile", label: "Hand opening fit", fn: scoreFitProfile },
    { key: "breakInFit", label: "Break-in tolerance", fn: scoreBreakInFit },
    { key: "leatherQualityFit", label: "Leather quality", fn: scoreLeatherQualityFit },
    { key: "webFit", label: "Web style fit", fn: scoreWebFit },
    { key: "budgetFit", label: "Budget fit", fn: scoreBudgetFit },
    { key: "versatilityFit", label: "Versatility", fn: scoreVersatilityFit },
    { key: "sportSpecificFit", label: "Sport-specific fit", fn: scoreSportSpecificFit },
    { key: "fastpitchFitImportance", label: "Fastpitch-specific fit", fn: scoreFastpitchFitImportance },
    { key: "youthFriendliness", label: "Youth friendliness", fn: scoreYouthFriendliness },
  ];

  const breakdown: ScoreBreakdownItem[] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const dim of dimensions) {
    const w = weights[dim.key];
    if (w === 0) continue; // skip zero-weight dimensions entirely

    const rawSub = clamp(dim.fn(profile, glove), 0, 1);
    const impact = rawSub * w;
    weightedSum += impact;
    totalWeight += w;

    breakdown.push({
      key: dim.key,
      label: dim.label,
      value: rawSub,
      impact,
    });
  }

  // Normalise to 0–100, then apply soft penalties.
  const normalised = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
  const penalty = softPenalty(profile, glove);
  const finalScore = Math.round(clamp(normalised * penalty, 0, 100));

  return {
    glove,
    score: finalScore,
    breakdown,
    reasons: [],
    tradeoffs: [],
    avoidIf: [],
  };
}

// ─── Ranker ───────────────────────────────────────────────────────────────────

/**
 * Filters the catalog, scores every eligible glove, sorts descending,
 * and returns the top N results with explanations attached.
 *
 * @param profile   Normalised user profile from profile.ts
 * @param catalog   Full combined glove catalog (all sports)
 * @param topN      How many results to return (default 3)
 * @param overrideWeights  Optional weight override — falls back to sport weights
 */
export function rankGloves(
  profile: UserProfile,
  catalog: GloveProduct[],
  topN = 3,
  overrideWeights?: ScoringWeights,
): GloveMatchResult[] {
  const weights = overrideWeights ?? weightsForSport(profile.sport);

  // ── Progressive filter relaxation ────────────────────────────────────────
  // We NEVER relax sport or glove type — those are fundamental mismatches.
  // We DO relax `inProduction` first (discontinued gloves are still useful
  // catalog data), and as a last resort, throw-hand availability.
  //
  // This guarantees a broad profile always receives *some* best-fit matches
  // rather than a hard zero.

  let eligible = filterCatalog(profile, catalog).eligible;

  if (eligible.length === 0) {
    // Tier 1 fallback: include discontinued gloves.
    eligible = filterCatalogRelaxed(profile, catalog, {
      ignoreInProduction: true,
    }).eligible;
  }

  if (eligible.length === 0) {
    // Tier 2 fallback: ignore throw-hand availability too.
    // The glove will still score poorly on secondary dimensions, but at
    // least the user sees candidates instead of a dead end.
    eligible = filterCatalogRelaxed(profile, catalog, {
      ignoreInProduction: true,
      ignoreThrowHand: true,
    }).eligible;
  }

  if (eligible.length === 0) {
    // Truly nothing matches the fundamental requirements (sport + glove type).
    // Bubble up empty so the UI can show the "retake" empty state.
    return [];
  }

  const scored = eligible.map((glove) => scoreGlove(profile, glove, weights));

  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, topN);

  // Attach explanations only to the top results (no wasted computation).
  return top.map((result) => {
    const { reasons, tradeoffs, avoidIf } = generateExplanation(
      profile,
      result.glove,
      result.breakdown,
    );
    return { ...result, reasons, tradeoffs, avoidIf };
  });
}
