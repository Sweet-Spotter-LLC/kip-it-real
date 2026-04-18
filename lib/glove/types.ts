/**
 * Kip It Real — core glove domain types
 * Powered by Sweet Spotter
 *
 * All numeric scale fields are on a -2..+5 scale unless otherwise noted.
 * Conventions:
 *  - pocketDepth:  -2 = very shallow, 0 = medium, +3 = very deep
 *  - fitProfile:   -2 = very snug, 0 = balanced, +3 = very roomy
 *  - easyClose:    -2 = very stiff close, 0 = balanced, +3 = instant close
 *  - stiffness:     0 = already broken in, 5 = extremely stiff raw leather
 *  - breakInTime:   0 = game-ready, 5 = months of break-in
 *  - leatherQuality: 1..5 scale (entry to top-tier)
 *  - transferSpeedBias: -2 = deep/secure (slow transfer), +3 = quick transfer
 *  - versatilityScore / catchSecurity / gameReadyLevel / durabilityScore: 0..5
 */

export type SportType = "baseball" | "fastpitch" | "slowpitch";

export type GloveType = "fielding" | "catcher" | "first_base";

export type PositionType =
  | "infield"
  | "outfield"
  | "pitcher"
  | "catcher"
  | "first_base"
  | "utility";

export type ThrowHand = "RHT" | "LHT";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type FitPreference = "snug" | "balanced" | "roomy";

export type PocketPreference = "shallow" | "medium" | "deep" | "unsure";

export type BreakInPreference = "game_ready" | "balanced" | "premium_stiff";

export type WebPreference =
  | "i_web"
  | "h_web"
  | "basket"
  | "closed"
  | "trap"
  | "modified_trap"
  | "single_post"
  | "two_piece_closed"
  | "unsure";

export type CatalogStatus = "draft" | "published";

export interface QuizAnswers {
  sport: SportType;
  ageGroup: "youth" | "teen" | "adult";
  throwHand: ThrowHand;
  primaryPosition: PositionType;
  /**
   * Secondary position. The literal "none" is the UI sentinel for
   * "No second position" — profile.ts coerces it to undefined.
   */
  secondaryPosition?: PositionType | "none";
  experienceLevel: ExperienceLevel;
  playFrequency: "casual" | "weekly" | "competitive";
  fitPreference: FitPreference;
  /** Not asked for catchers / first base — conditional on position. */
  pocketPreference?: PocketPreference;
  breakInPreference: BreakInPreference;
  /** Not asked for catchers / first base — conditional on position. */
  webPreference?: WebPreference;
  budgetMin?: number;
  budgetMax?: number;
  /**
   * True when the user took the Kip It Real premium path and skipped
   * the budget question. Profile builder treats this as "no ceiling".
   */
  budgetSkipped?: boolean;
  preferredBrands?: string[];
  /** Only asked for infield / utility — suppressed for other positions. */
  wantsFastClose?: boolean;
  /** The "Kip it Real?" fork-in-the-road — true locks in premium path. */
  wantsPremiumLeather?: boolean;
  wantsVersatility?: boolean;
  fastpitchFitImportant?: boolean;
}

export interface UserProfile {
  sport: SportType;
  ageGroup: "youth" | "teen" | "adult";
  throwHand: ThrowHand;
  primaryPosition: PositionType;
  secondaryPosition?: PositionType;
  gloveTypeNeeded: GloveType;
  experienceLevel: ExperienceLevel;
  playFrequency: "casual" | "weekly" | "competitive";
  /** Numeric target on fit scale (-2 snug .. +3 roomy) */
  fitTarget: number;
  /** Numeric target on pocket depth scale (-2 shallow .. +3 deep) */
  pocketDepthTarget: number;
  /** How much break-in the player can tolerate (0 game-ready .. 5 premium stiff) */
  breakInTolerance: number;
  webPreference?: WebPreference;
  budgetMin: number;
  budgetMax: number;
  wantsVersatility: boolean;
  wantsFastClose: boolean;
  wantsPremiumLeather: boolean;
  fastpitchFitImportant: boolean;
  /** Brand allowlist. Empty/undefined = user is open to any brand. */
  preferredBrands?: string[];
  recommendedSizeMin: number;
  recommendedSizeMax: number;
}

export interface PurchaseLink {
  retailer: string;
  url: string;
}

export interface GloveProduct {
  id: string;
  name: string;
  brand: string;
  year: number;
  sport: SportType;
  gloveType: GloveType;
  positionTags: PositionType[];
  throwHandAvailability: ThrowHand[];
  sizeInches: number;
  patternType:
    | "infield"
    | "outfield"
    | "pitcher"
    | "utility"
    | "softball_specific"
    | "catcher"
    | "first_base";
  webType: WebPreference;
  pocketDepth: number;
  fitProfile: number;
  wristOpening: number;
  handStallWidth: number;
  easyClose: number;
  stiffness: number;
  breakInTime: number;
  leatherQuality: number;
  durabilityScore: number;
  gameReadyLevel: number;
  transferSpeedBias: number;
  catchSecurity: number;
  versatilityScore: number;
  youthFriendly: boolean;
  fastpitchFit: boolean;
  slowpitchFriendly: boolean;
  price: number;
  msrp?: number;
  inProduction: boolean;
  lastVerified?: string;
  descriptionShort?: string;
  notes?: string;
  purchaseLinks?: PurchaseLink[];
  status: CatalogStatus;
}

export interface ScoreBreakdownItem {
  key: string;
  label: string;
  /** Raw sub-score contribution, 0..1 */
  value: number;
  /** Weighted contribution to final score */
  impact: number;
}

export interface GloveMatchResult {
  glove: GloveProduct;
  /** Final composite match score, 0..100 */
  score: number;
  reasons: string[];
  tradeoffs: string[];
  avoidIf: string[];
  breakdown: ScoreBreakdownItem[];
}

export interface QuizQuestionOption {
  label: string;
  value: string | number | boolean;
  /** Optional helper copy shown under the option. */
  hint?: string;
}

export interface QuizQuestion {
  id: keyof QuizAnswers | string;
  step: number;
  label: string;
  description?: string;
  /**
   * Optional longer-form disclaimer rendered as a callout (e.g. the
   * Kip It Real premium-path warning). Kept separate from description
   * so it can be styled as a warning rather than supporting copy.
   */
  warning?: string;
  type: "single_select" | "multi_select" | "range" | "boolean" | "brand_picker";
  options?: QuizQuestionOption[];
  /**
   * Optional dynamic options resolver. Used by questions whose choices
   * depend on prior answers (e.g. web-style options filtered by the
   * user's selected position). Returns undefined to fall back to
   * the static `options` array.
   */
  getOptions?: (
    answers: Partial<QuizAnswers>,
  ) => QuizQuestionOption[] | undefined;
  /** Gate for conditional display based on prior answers */
  showIf?: (answers: Partial<QuizAnswers>) => boolean;
  /** Optional default if the user skips */
  defaultValue?: string | number | boolean | string[];
}

export interface SizeRecommendation {
  min: number;
  max: number;
  label: string;
  reason: string;
}

/** Weight map used by scoring.ts — every key must be present. */
export interface ScoringWeights {
  positionFit: number;
  sizeFit: number;
  pocketFit: number;
  fitProfile: number;
  breakInFit: number;
  leatherQualityFit: number;
  webFit: number;
  budgetFit: number;
  versatilityFit: number;
  sportSpecificFit: number;
  fastpitchFitImportance: number;
  youthFriendliness: number;
}
