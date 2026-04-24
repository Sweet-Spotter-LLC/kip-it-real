/**
 * Shared test fixtures — keep in sync with seed data where possible.
 * These are the minimal valid objects needed to exercise the business logic.
 */

import type { GloveProduct, UserProfile, QuizAnswers } from "@/lib/glove/types";

// ─── Glove fixtures ────────────────────────────────────────────────────────

export const BASEBALL_INFIELD_GLOVE: GloveProduct = {
  id: "test-rawlings-hoh-11-75",
  name: "Test Rawlings HoH 11.75",
  brand: "Rawlings",
  year: 2025,
  sport: "baseball",
  gloveType: "fielding",
  positionTags: ["infield", "pitcher"],
  throwHandAvailability: ["RHT", "LHT"],
  sizeInches: 11.75,
  patternType: "infield",
  webType: "i_web",
  pocketDepth: 2,
  fitProfile: 2,
  wristOpening: 2,
  handStallWidth: 2,
  easyClose: 2,
  stiffness: 4,
  breakInTime: 4,
  leatherQuality: 5,
  durabilityScore: 5,
  gameReadyLevel: 2,
  transferSpeedBias: -1,
  catchSecurity: 3,
  versatilityScore: 3,
  youthFriendly: false,
  fastpitchFit: false,
  slowpitchFriendly: false,
  price: 299,
  msrp: 329,
  inProduction: true,
  lastVerified: "2026-04-14",
  descriptionShort: "Premium infield glove.",
  purchaseLinks: [],
  status: "published",
};

export const BASEBALL_OUTFIELD_GLOVE: GloveProduct = {
  ...BASEBALL_INFIELD_GLOVE,
  id: "test-mizuno-outfield",
  name: "Test Mizuno Outfield 12.75",
  sport: "baseball",
  gloveType: "fielding",
  positionTags: ["outfield"],
  sizeInches: 12.75,
  patternType: "outfield",
  webType: "trap",
  pocketDepth: 3,
  fitProfile: 1,
  easyClose: 0,
  stiffness: 3,
  breakInTime: 3,
  transferSpeedBias: -2,
  catchSecurity: 5,
  versatilityScore: 2,
  price: 319,
};

export const FASTPITCH_GLOVE: GloveProduct = {
  ...BASEBALL_INFIELD_GLOVE,
  id: "test-fastpitch-infield",
  name: "Test Fastpitch Infield 11.75",
  sport: "fastpitch",
  positionTags: ["infield", "pitcher"],
  fastpitchFit: true,
  fitProfile: -2,
  wristOpening: -1,
  handStallWidth: -2,
  price: 219,
};

export const SLOWPITCH_GLOVE: GloveProduct = {
  ...BASEBALL_INFIELD_GLOVE,
  id: "test-slowpitch-utility",
  name: "Test Slowpitch Utility 13",
  sport: "slowpitch",
  positionTags: ["utility", "outfield"],
  sizeInches: 13.0,
  patternType: "utility",
  slowpitchFriendly: true,
  pocketDepth: 2,
  versatilityScore: 5,
  price: 99,
  stiffness: 1,
  breakInTime: 1,
};

export const CATCHER_MITT: GloveProduct = {
  ...BASEBALL_INFIELD_GLOVE,
  id: "test-catcher-mitt",
  name: "Test Catcher's Mitt 34",
  gloveType: "catcher",
  positionTags: ["catcher"],
  sizeInches: 34.0,
  patternType: "softball_specific",
  webType: "closed",
  pocketDepth: 3,
  catchSecurity: 5,
  versatilityScore: 1,
};

export const FIRST_BASE_MITT: GloveProduct = {
  ...BASEBALL_INFIELD_GLOVE,
  id: "test-first-base-mitt",
  name: "Test First Base Mitt 12.25",
  gloveType: "first_base",
  positionTags: ["first_base"],
  sizeInches: 12.25,
  patternType: "utility",
  webType: "single_post",
};

export const DISCONTINUED_GLOVE: GloveProduct = {
  ...BASEBALL_INFIELD_GLOVE,
  id: "test-discontinued",
  name: "Test Discontinued Glove",
  inProduction: false,
};

export const LHT_ONLY_GLOVE: GloveProduct = {
  ...BASEBALL_INFIELD_GLOVE,
  id: "test-lht-only",
  name: "Test LHT Only",
  throwHandAvailability: ["LHT"],
};

export const BUDGET_GLOVE: GloveProduct = {
  ...BASEBALL_INFIELD_GLOVE,
  id: "test-budget-glove",
  name: "Test Budget Glove",
  price: 89,
  leatherQuality: 2,
  stiffness: 1,
  breakInTime: 1,
  gameReadyLevel: 5,
  youthFriendly: true,
};

// ─── Profile fixtures ──────────────────────────────────────────────────────

export const ADULT_INFIELD_BASEBALL_PROFILE: UserProfile = {
  sport: "baseball",
  ageGroup: "adult",
  throwHand: "RHT",
  primaryPosition: "infield",
  gloveTypeNeeded: "fielding",
  experienceLevel: "advanced",
  playFrequency: "competitive",
  fitTarget: 0,          // balanced
  pocketDepthTarget: 0,  // medium
  breakInTolerance: 5,   // premium stiff OK
  webPreference: "i_web",
  budgetMin: 0,
  budgetMax: 400,
  wantsVersatility: false,
  wantsPremiumLeather: true,
  fastpitchFitImportant: false,
  openToCrossoverGloves: false,
  recommendedSizeMin: 11.25,
  recommendedSizeMax: 11.75,
};

export const ADULT_OUTFIELD_BASEBALL_PROFILE: UserProfile = {
  ...ADULT_INFIELD_BASEBALL_PROFILE,
  primaryPosition: "outfield",
  fitTarget: 1,
  pocketDepthTarget: 2,
  breakInTolerance: 3,
  webPreference: "trap",
  recommendedSizeMin: 12.25,
  recommendedSizeMax: 12.75,
};

export const YOUTH_INFIELD_BASEBALL_PROFILE: UserProfile = {
  ...ADULT_INFIELD_BASEBALL_PROFILE,
  ageGroup: "youth",
  experienceLevel: "beginner",
  breakInTolerance: 1,
  wantsPremiumLeather: false,
  recommendedSizeMin: 10.5,
  recommendedSizeMax: 11.0,
};

export const FASTPITCH_PROFILE: UserProfile = {
  sport: "fastpitch",
  ageGroup: "adult",
  throwHand: "RHT",
  primaryPosition: "infield",
  gloveTypeNeeded: "fielding",
  experienceLevel: "intermediate",
  playFrequency: "weekly",
  fitTarget: -1.5,       // snug
  pocketDepthTarget: 0,
  breakInTolerance: 2,
  webPreference: "basket",
  budgetMin: 0,
  budgetMax: 300,
  wantsVersatility: false,
  wantsPremiumLeather: false,
  fastpitchFitImportant: true,
  openToCrossoverGloves: false,
  recommendedSizeMin: 11.75,
  recommendedSizeMax: 12.25,
};

export const CATCHER_PROFILE: UserProfile = {
  ...ADULT_INFIELD_BASEBALL_PROFILE,
  primaryPosition: "catcher",
  gloveTypeNeeded: "catcher",
  pocketDepthTarget: 2,
  webPreference: undefined,
  recommendedSizeMin: 32.5,
  recommendedSizeMax: 34.0,
};

export const SLOWPITCH_CROSSOVER_PROFILE: UserProfile = {
  sport: "slowpitch",
  ageGroup: "adult",
  throwHand: "RHT",
  primaryPosition: "utility",
  gloveTypeNeeded: "fielding",
  experienceLevel: "intermediate",
  playFrequency: "weekly",
  fitTarget: 0,
  pocketDepthTarget: 0.5,
  breakInTolerance: 3,
  webPreference: undefined,
  budgetMin: 0,
  budgetMax: 400,
  wantsVersatility: true,
  wantsPremiumLeather: false,
  fastpitchFitImportant: false,
  openToCrossoverGloves: true,
  recommendedSizeMin: 12.75,
  recommendedSizeMax: 13.5,
};

// ─── Quiz answer fixtures ──────────────────────────────────────────────────

export const ADULT_BASEBALL_INFIELD_ANSWERS: QuizAnswers = {
  sport: "baseball",
  ageGroup: "adult",
  throwHand: "RHT",
  primaryPosition: "infield",
  experienceLevel: "advanced",
  playFrequency: "competitive",
  fitPreference: "balanced",
  pocketPreference: "medium",
  breakInPreference: "premium_stiff",
  webPreference: "i_web",
  budgetMax: 400,
  wantsPremiumLeather: true,
};

// ─── Minimal valid catalog for filter/ranking tests ────────────────────────

export const SAMPLE_CATALOG: GloveProduct[] = [
  BASEBALL_INFIELD_GLOVE,
  BASEBALL_OUTFIELD_GLOVE,
  FASTPITCH_GLOVE,
  SLOWPITCH_GLOVE,
  CATCHER_MITT,
  FIRST_BASE_MITT,
  DISCONTINUED_GLOVE,
  LHT_ONLY_GLOVE,
  BUDGET_GLOVE,
];
