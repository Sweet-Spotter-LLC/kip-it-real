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
  PurchaseLink,
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
 *
 * Utility-tagged gloves receive partial credit for any standard fielding
 * position — they're designed to play everywhere, so scoring them as a
 * hard zero when the user picked "infield" (for example) is too punishing.
 */
function scorePositionFit(profile: UserProfile, glove: GloveProduct): number {
  const primaryMatch = glove.positionTags.includes(profile.primaryPosition);

  // A utility-tagged glove covers any standard fielding spot.
  const isUtilityGlove = glove.positionTags.includes("utility");
  const isStandardFieldingPos =
    profile.primaryPosition !== "catcher" &&
    profile.primaryPosition !== "first_base";
  const utilityMatch = !primaryMatch && isUtilityGlove && isStandardFieldingPos;

  if (!primaryMatch && !utilityMatch) return 0;

  const secondaryMatch =
    profile.secondaryPosition &&
    glove.positionTags.includes(profile.secondaryPosition);

  if (primaryMatch) {
    return secondaryMatch ? 1.0 : 0.85;
  }

  // Utility glove covering the player's position but not explicitly tagged.
  return secondaryMatch ? 0.80 : 0.65;
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
 *
 * Special case: closed web is functionally incompatible with infield play
 * (hides grip, slows transfer, wrong geometry). Apply a meaningful penalty
 * regardless of preference. Pitcher positions are unaffected — closed web
 * is the right choice there.
 */
function scoreWebFit(profile: UserProfile, glove: GloveProduct): number {
  const isClosedInfield =
    glove.webType === "closed" && profile.primaryPosition === "infield";

  if (isClosedInfield) {
    // Even if the player asked for closed web, flag it as a mismatch.
    // A player who specifically requested closed web still gets a gentle
    // nudge (0.25) vs the harsher penalty for no preference (0.1).
    return profile.webPreference === "closed" ? 0.25 : 0.1;
  }

  if (!profile.webPreference) {
    // No preference — check if web is typical for this position.
    const meta = WEB_TYPE_META[glove.webType];
    return meta?.bestFor.includes(profile.primaryPosition) ? 1.0 : 0.6;
  }
  return glove.webType === profile.webPreference ? 1.0 : 0.4;
}

/**
 * Budget fit: soft scoring around the user's selected range.
 *
 * Behaviour (matches BUDGET_SOFT_FILTER spec in types.ts):
 *   - Inside [budgetMin, budgetMax]         → 1.0                 (strong)
 *   - Slightly above budgetMax (≤ 15 %)     → 0.85 → 0.75         (modest penalty)
 *   - Further above (15–50 %)               → 0.75 → 0.30         (larger penalty)
 *   - Far above (> 50 %)                    → 0.30 → 0.05         (heavy penalty)
 *   - Slightly below budgetMin (within 40%) → 0.90                (acceptable)
 *   - Very far below budgetMin              → 0.70                (neutral, not a win)
 *
 * This NEVER returns 0 — budget is a soft signal, not a rejection. Gloves stay
 * ranked by everything else when no in-budget option exists.
 */
export function scoreBudgetFit(profile: UserProfile, glove: GloveProduct): number {
  const { budgetMin, budgetMax } = profile;
  const price = glove.price;

  // Within range → perfect fit.
  if (price >= budgetMin && price <= budgetMax) return 1.0;

  // Above the ceiling.
  if (price > budgetMax) {
    const ratio = (price - budgetMax) / Math.max(budgetMax, 1);
    if (ratio <= 0.15) return clamp(0.85 - (ratio / 0.15) * 0.1, 0.75, 0.85);
    if (ratio <= 0.5) return clamp(0.75 - ((ratio - 0.15) / 0.35) * 0.45, 0.3, 0.75);
    return clamp(0.3 - Math.min(ratio - 0.5, 1) * 0.25, 0.05, 0.3);
  }

  // Below the floor (only meaningful when floor > 0).
  if (budgetMin > 0) {
    const shortfall = (budgetMin - price) / budgetMin;
    if (shortfall <= 0.4) return 0.9;
    return 0.7; // very cheap for the chosen bracket — not auto-elevated
  }

  // budgetMin is 0 — price below budgetMax is always fine.
  return 1.0;
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
 * Slowpitch-friendly gloves (native or baseball crossover) in a slowpitch
 * context score equally — crossovers compete on their own merits without
 * an artificial preference for purpose-built gear.
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

/**
 * Value fit: rewards gloves with strong value scores.
 * Weight is intentionally low (~3 out of ~106 total) so this can break
 * ties and slightly elevate comparable gloves without overpowering
 * position fit, size fit, leather quality, or budget alignment.
 *
 * Scoring:
 *   - valueScore 0–100 → normalized to 0..1
 *   - undefined (blank in catalog) → 0.5 (neutral; no help or harm)
 *   - This does NOT double-count price: budgetFit already handles cost
 *     alignment. valueScore captures quality-adjusted value, not just price.
 */
function scoreValueFit(_profile: UserProfile, glove: GloveProduct): number {
  if (glove.valueScore === undefined) return 0.5; // neutral
  return clamp(glove.valueScore / 100, 0, 1);
}

// ─── Soft filter penalties ────────────────────────────────────────────────────

/**
 * Applies a composite multiplicative penalty based on soft filter flags.
 * Maximum combined penalty caps at -25 % of the total score.
 */
function softPenalty(profile: UserProfile, glove: GloveProduct): number {
  const flags = softFilter(profile, glove);
  let penalty = 0;

  // NOTE: overBudget is intentionally NOT applied here — budget is handled
  // by scoreBudgetFit() as a graduated soft score. Double-penalising would
  // push above-budget gloves too far down when they're the only reasonable
  // fit (e.g. user's whole catalog is above their selected ceiling).
  if (flags.fastpitchFitMismatch) penalty += 0.08;
  if (flags.slowpitchMismatch) penalty += 0.06;
  if (flags.youthMismatch) penalty += 0.07;
  if (flags.brandMismatch) penalty += 0.04;
  if (flags.secondaryPositionMismatch) penalty += 0.03;
  if (flags.underBudget) penalty += 0.02;
  // Light crossover penalty: baseball glove in a fastpitch context.
  // Slowpitch crossovers are explicitly selected via slowpitchFriendly —
  // no penalty there; they compete on their own merits.
  if (flags.crossoverBaseball && profile.sport === "fastpitch") penalty += 0.05;

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
): Omit<GloveMatchResult, "reasons" | "tradeoffs"> & {
  reasons: [];
  tradeoffs: [];
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
    { key: "valueFit", label: "Value for money", fn: scoreValueFit },
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
  };
}

/**
 * Absolute distance from `glove.price` to the user's budget range.
 * Zero when the price is inside [budgetMin, budgetMax]. Exported for ranking
 * tie-breakers and for the "closest-to-budget" result ordering.
 */
export function budgetDistance(
  profile: UserProfile,
  glove: GloveProduct,
): number {
  const { budgetMin, budgetMax } = profile;
  if (glove.price < budgetMin) return budgetMin - glove.price;
  if (glove.price > budgetMax) return glove.price - budgetMax;
  return 0;
}

/**
 * Convenience: does at least one glove fall inside the profile's budget range?
 * Used by the API / UI to display a "no in-budget matches" banner.
 */
export function anyGloveInBudget(
  profile: UserProfile,
  gloves: GloveProduct[],
): boolean {
  return gloves.some(
    (g) => g.price >= profile.budgetMin && g.price <= profile.budgetMax,
  );
}

// ─── Variant deduplication ────────────────────────────────────────────────────

/**
 * Returns a structural key that identifies the core glove model.
 *
 * Rule: brand + patternType + sizeInches + webType + gloveType + leatherQuality
 *
 * Two gloves with the same key are treated as colorway / SKU variants of the
 * same model. The highest-scored variant surfaces in results; purchase links
 * from all variants are merged so every buying option remains accessible.
 *
 * Gloves with meaningfully different specs (different web, size, or leather
 * tier) produce different keys and always rank as distinct entries.
 */
function modelKey(glove: GloveProduct): string {
  return [
    glove.brand,
    glove.patternType,
    glove.sizeInches.toFixed(2),
    glove.webType,
    glove.gloveType,
    glove.leatherQuality,
  ].join("|");
}

/**
 * Merge purchase links from variant entries into their canonical representative.
 * Deduplicates by URL so the same link never appears twice.
 */
function mergeVariants(
  scored: ReturnType<typeof scoreGlove>[],
): ReturnType<typeof scoreGlove>[] {
  // First pass: collect all purchase links keyed by model.
  const linksByKey: Record<string, PurchaseLink[]> = {};
  for (const result of scored) {
    const key = modelKey(result.glove);
    if (!linksByKey[key]) linksByKey[key] = [];
    for (const link of result.glove.purchaseLinks ?? []) {
      if (!linksByKey[key].some((l) => l.url === link.url)) {
        linksByKey[key].push(link);
      }
    }
  }

  // Second pass: keep highest-scored per key (list is already sorted desc).
  const seen = new Set<string>();
  return scored
    .filter((result) => {
      const key = modelKey(result.glove);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((result) => {
      const key = modelKey(result.glove);
      const merged = linksByKey[key];
      // Only rebuild glove object when the merged list is longer than original.
      if (merged.length <= (result.glove.purchaseLinks?.length ?? 0)) {
        return result;
      }
      return {
        ...result,
        glove: { ...result.glove, purchaseLinks: merged },
      };
    });
}

// ─── Ranker ───────────────────────────────────────────────────────────────────

/**
 * Filters the catalog, scores every eligible glove, sorts descending,
 * deduplicates same-model variants, and returns the top N results with
 * explanations attached.
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

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-breaker: prefer the glove closest to the user's budget range.
    // This pulls nearest-priced gloves up when everything else is equal.
    return budgetDistance(profile, a.glove) - budgetDistance(profile, b.glove);
  });

  // Collapse same-model variants (colorways / SKU variants) into a single entry,
  // merging their purchase links. Freed slots are filled by the next-best distinct
  // model, improving result diversity.
  const deduped = mergeVariants(scored);

  const top = deduped.slice(0, topN);

  // Attach explanations only to the top results (no wasted computation).
  return top.map((result) => {
    const { reasons, tradeoffs } = generateExplanation(
      profile,
      result.glove,
      result.breakdown,
    );
    return { ...result, reasons, tradeoffs };
  });
}
