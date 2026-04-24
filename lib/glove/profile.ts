/**
 * QuizAnswers → UserProfile normalization.
 *
 * This is the single source of truth that turns user-facing answers into
 * numeric targets the scoring engine can reason about. Keeping all mapping
 * here means scoring.ts and explain.ts never need to look at raw strings.
 */

import type {
  QuizAnswers,
  UserProfile,
  GloveType,
  PositionType,
  FitPreference,
  PocketPreference,
  BreakInPreference,
} from "./types";
import { recommendSize } from "./sizing";

/** Default budget window used when the user skips the budget question. */
const DEFAULT_BUDGET_MIN = 0;
const DEFAULT_BUDGET_MAX = 400;

/**
 * "Maximum" budget sentinel used when the Kip it Real premium path is
 * selected (wantsPremiumLeather = true + budgetSkipped = true). Big enough
 * that every real-world glove price is below it, which keeps the
 * downstream budget-fit scorer in its "inside range" (1.0) branch without
 * needing Infinity in the arithmetic.
 */
export const PREMIUM_PATH_BUDGET_CEILING = 10_000;

/** Positions that require dedicated mitt geometry. */
function gloveTypeForPosition(pos: PositionType): GloveType {
  if (pos === "catcher") return "catcher";
  if (pos === "first_base") return "first_base";
  return "fielding";
}

/** Map snug/balanced/roomy to a numeric target on the -2..+3 fit scale. */
function fitTargetFor(fit: FitPreference | undefined): number {
  switch (fit) {
    case "snug":
      return -1.5;
    case "roomy":
      return 1.5;
    case "balanced":
    default:
      return 0;
  }
}

/**
 * Map shallow/medium/deep/unsure to a target on the -2..+3 pocket scale.
 * When the question was skipped (catchers / first base), fall back to a
 * position-appropriate default so scoring never sees NaN.
 */
function pocketTargetFor(
  pocket: PocketPreference | undefined,
  position: PositionType,
): number {
  if (!pocket || pocket === "unsure") {
    // Fall back to a sensible default per position family.
    if (position === "outfield") return 1.5;
    if (position === "catcher") return 2;
    if (position === "first_base") return 1;
    if (position === "infield" || position === "pitcher") return -0.5;
    return 0.5; // utility
  }
  switch (pocket) {
    case "shallow":
      return -1.5;
    case "medium":
      return 0;
    case "deep":
      return 2;
  }
}

/**
 * Map break-in preference to how much stiffness the player can tolerate.
 * 0 = must be game-ready, 5 = premium raw leather is fine.
 */
function breakInToleranceFor(pref: BreakInPreference | undefined): number {
  switch (pref) {
    case "game_ready":
      return 1;
    case "premium_stiff":
      return 5;
    case "balanced":
    default:
      return 3;
  }
}

/** Coerce the UI "none" sentinel to undefined. */
function normaliseSecondaryPosition(
  v: QuizAnswers["secondaryPosition"],
): PositionType | undefined {
  if (!v || v === "none") return undefined;
  return v;
}

export function buildUserProfile(answers: QuizAnswers): UserProfile {
  const gloveTypeNeeded = gloveTypeForPosition(answers.primaryPosition);

  // Slowpitch skips the age question — default to adult.
  const ageGroup: "youth" | "teen" | "adult" = answers.ageGroup ?? "adult";

  // Infer versatility preference from position choices: utility players and
  // anyone covering a second position implicitly want a versatile glove.
  // This replaces the removed "Should it play multiple positions?" question.
  const secondaryPos = normaliseSecondaryPosition(answers.secondaryPosition);
  const wantsVersatility =
    answers.primaryPosition === "utility" || secondaryPos !== undefined;

  const rec = recommendSize({
    sport: answers.sport,
    ageGroup,
    primaryPosition: answers.primaryPosition,
    experienceLevel: answers.experienceLevel,
    fastpitchFitImportant: answers.fastpitchFitImportant,
    wantsVersatility,
  });

  // Budget handling:
  //   - Kip it Real premium path: the user explicitly skipped budget, so we
  //     treat it as "no ceiling" via a large sentinel. Scoring stays happy
  //     and the budget-mismatch banner never fires.
  //   - Otherwise, use the provided budget or fall back to safe defaults.
  const tookPremiumPath =
    answers.wantsPremiumLeather === true && answers.budgetSkipped === true;
  const budgetMin = tookPremiumPath
    ? DEFAULT_BUDGET_MIN
    : answers.budgetMin !== undefined
    ? answers.budgetMin
    : DEFAULT_BUDGET_MIN;
  const budgetMax = tookPremiumPath
    ? PREMIUM_PATH_BUDGET_CEILING
    : answers.budgetMax !== undefined
    ? answers.budgetMax
    : DEFAULT_BUDGET_MAX;

  // Brand filter is intentionally undefined when the user leaves the picker
  // empty — that represents "open to any brand" and avoids false-negative
  // brand-mismatch penalties during scoring.
  const preferredBrands =
    answers.preferredBrands && answers.preferredBrands.length > 0
      ? answers.preferredBrands
      : undefined;

  // Preferred-size override: when the player explicitly selected a specific
  // size, tighten the window to ±0.25" around their choice so scoring rewards
  // gloves closest to what they asked for. "any" and undefined both mean
  // "let the algorithm decide" — the recommendSize output is used unchanged.
  const preferred =
    typeof answers.preferredSizeInches === "number"
      ? answers.preferredSizeInches
      : undefined;

  return {
    sport: answers.sport,
    ageGroup,
    throwHand: answers.throwHand,
    primaryPosition: answers.primaryPosition,
    secondaryPosition: secondaryPos,
    gloveTypeNeeded,
    experienceLevel: answers.experienceLevel,
    playFrequency: answers.playFrequency,
    fitTarget: fitTargetFor(answers.fitPreference),
    pocketDepthTarget: pocketTargetFor(
      answers.pocketPreference,
      answers.primaryPosition,
    ),
    breakInTolerance: breakInToleranceFor(answers.breakInPreference),
    webPreference:
      answers.webPreference === "unsure" || !answers.webPreference
        ? undefined
        : answers.webPreference,
    budgetMin,
    budgetMax,
    wantsVersatility,
    wantsPremiumLeather: Boolean(answers.wantsPremiumLeather),
    fastpitchFitImportant:
      answers.sport === "fastpitch"
        ? Boolean(answers.fastpitchFitImportant)
        : false,
    openToCrossoverGloves:
      answers.sport === "fastpitch" || answers.sport === "slowpitch"
        ? Boolean(answers.openToCrossoverGloves)
        : false,
    preferredBrands,
    recommendedSizeMin: preferred !== undefined ? preferred - 0.25 : rec.min,
    recommendedSizeMax: preferred !== undefined ? preferred + 0.25 : rec.max,
  };
}

/** Exposed for tests — small internal helpers. */
export const __private = {
  fitTargetFor,
  pocketTargetFor,
  breakInToleranceFor,
  gloveTypeForPosition,
  normaliseSecondaryPosition,
};
