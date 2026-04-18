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
