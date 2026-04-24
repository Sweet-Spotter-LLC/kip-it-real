/**
 * Regression tests for buildUserProfile — specifically the Kip it Real
 * premium path, which should disable the budget constraint entirely.
 */

import { describe, it, expect } from "vitest";
import {
  buildUserProfile,
  PREMIUM_PATH_BUDGET_CEILING,
} from "@/lib/glove/profile";
import { ADULT_BASEBALL_INFIELD_ANSWERS } from "../fixtures";
import type { QuizAnswers } from "@/lib/glove/types";

describe("buildUserProfile — preferred size override", () => {
  it("uses default size range when preferredSizeInches is not set", () => {
    const profile = buildUserProfile(ADULT_BASEBALL_INFIELD_ANSWERS);
    // adult baseball infield default: [11.25, 11.75]
    expect(profile.recommendedSizeMin).toBe(11.25);
    expect(profile.recommendedSizeMax).toBe(11.75);
  });

  it("uses default size range when preferredSizeInches is 'any'", () => {
    const answers: QuizAnswers = {
      ...ADULT_BASEBALL_INFIELD_ANSWERS,
      preferredSizeInches: "any",
    };
    const profile = buildUserProfile(answers);
    expect(profile.recommendedSizeMin).toBe(11.25);
    expect(profile.recommendedSizeMax).toBe(11.75);
  });

  it("narrows the range to ±0.25\" around preferredSizeInches when set", () => {
    const answers: QuizAnswers = {
      ...ADULT_BASEBALL_INFIELD_ANSWERS,
      preferredSizeInches: 12.0,
    };
    const profile = buildUserProfile(answers);
    expect(profile.recommendedSizeMin).toBe(11.75); // 12.0 - 0.25
    expect(profile.recommendedSizeMax).toBe(12.25); // 12.0 + 0.25
  });

  it("preferred size overrides the algorithm's recommendation", () => {
    // Default for adult baseball infield is 11.25–11.75.
    // Explicitly choosing 11.5 should tighten the window.
    const answers: QuizAnswers = {
      ...ADULT_BASEBALL_INFIELD_ANSWERS,
      preferredSizeInches: 11.5,
    };
    const profile = buildUserProfile(answers);
    expect(profile.recommendedSizeMin).toBe(11.25); // 11.5 - 0.25
    expect(profile.recommendedSizeMax).toBe(11.75); // 11.5 + 0.25
  });
});

describe("buildUserProfile — Kip it Real premium path", () => {
  it("uses the premium-path budget ceiling when budgetSkipped is true", () => {
    const answers: QuizAnswers = {
      ...ADULT_BASEBALL_INFIELD_ANSWERS,
      wantsPremiumLeather: true,
      budgetSkipped: true,
      // Deliberately leave budgetMax undefined to simulate the skipped step.
      budgetMax: undefined,
      budgetMin: undefined,
    };
    const profile = buildUserProfile(answers);
    expect(profile.budgetMax).toBe(PREMIUM_PATH_BUDGET_CEILING);
    expect(profile.budgetMin).toBe(0);
    expect(profile.wantsPremiumLeather).toBe(true);
  });

  it("respects an explicit budgetMax when premium path is not taken", () => {
    const answers: QuizAnswers = {
      ...ADULT_BASEBALL_INFIELD_ANSWERS,
      wantsPremiumLeather: false,
      budgetSkipped: false,
      budgetMax: 250,
    };
    const profile = buildUserProfile(answers);
    expect(profile.budgetMax).toBe(250);
  });

  it("ignores a stray budgetMax if budgetSkipped overrides it", () => {
    const answers: QuizAnswers = {
      ...ADULT_BASEBALL_INFIELD_ANSWERS,
      wantsPremiumLeather: true,
      budgetSkipped: true,
      budgetMax: 99, // stale from before the user picked the premium path
    };
    const profile = buildUserProfile(answers);
    expect(profile.budgetMax).toBe(PREMIUM_PATH_BUDGET_CEILING);
  });
});
