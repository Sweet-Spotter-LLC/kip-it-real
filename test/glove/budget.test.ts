/**
 * Regression tests for the soft-budget behaviour.
 *
 * Invariants these tests protect:
 *   1. scoreBudgetFit never returns 0 — budget is a soft signal.
 *   2. anyGloveInBudget is true iff at least one glove price is inside
 *      [budgetMin, budgetMax].
 *   3. rankGloves still returns matches even when every glove in the catalog
 *      is above the user's budget ceiling.
 */

import { describe, it, expect } from "vitest";
import {
  scoreBudgetFit,
  anyGloveInBudget,
  budgetDistance,
  rankGloves,
} from "@/lib/glove/scoring";
import {
  ADULT_INFIELD_BASEBALL_PROFILE,
  BASEBALL_INFIELD_GLOVE,
  SAMPLE_CATALOG,
} from "../fixtures";

// Everything in SAMPLE_CATALOG is $100+ — a $50 ceiling guarantees none fit.
const STINGY_PROFILE = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMax: 50, budgetMin: 0 };

describe("scoreBudgetFit — soft scoring", () => {
  it("returns 1.0 when the glove is inside the range", () => {
    const profile = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMin: 100, budgetMax: 400 };
    const glove = { ...BASEBALL_INFIELD_GLOVE, price: 250 };
    expect(scoreBudgetFit(profile, glove)).toBe(1);
  });

  it("penalises a glove slightly above budget modestly", () => {
    const profile = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMin: 0, budgetMax: 200 };
    const glove = { ...BASEBALL_INFIELD_GLOVE, price: 220 }; // 10 % over
    const s = scoreBudgetFit(profile, glove);
    expect(s).toBeGreaterThan(0.7);
    expect(s).toBeLessThan(1);
  });

  it("penalises a glove far above budget more heavily", () => {
    const profile = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMin: 0, budgetMax: 100 };
    const glove = { ...BASEBALL_INFIELD_GLOVE, price: 200 }; // 100 % over
    const s = scoreBudgetFit(profile, glove);
    expect(s).toBeGreaterThan(0); // never zero
    expect(s).toBeLessThan(0.35);
  });

  it("never returns zero, even for gloves many multiples above budget", () => {
    const profile = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMin: 0, budgetMax: 20 };
    const glove = { ...BASEBALL_INFIELD_GLOVE, price: 500 };
    expect(scoreBudgetFit(profile, glove)).toBeGreaterThan(0);
  });

  it("treats slightly-below-floor as acceptable", () => {
    const profile = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMin: 200, budgetMax: 400 };
    const glove = { ...BASEBALL_INFIELD_GLOVE, price: 160 }; // 20% below floor
    const s = scoreBudgetFit(profile, glove);
    expect(s).toBeGreaterThanOrEqual(0.85);
  });

  it("does not reward pricing far below the floor as a perfect fit", () => {
    const profile = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMin: 300, budgetMax: 500 };
    const glove = { ...BASEBALL_INFIELD_GLOVE, price: 50 };
    const s = scoreBudgetFit(profile, glove);
    expect(s).toBeLessThan(1);
    expect(s).toBeGreaterThan(0);
  });
});

describe("budgetDistance", () => {
  it("is zero inside the range", () => {
    const p = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMin: 100, budgetMax: 200 };
    expect(budgetDistance(p, { ...BASEBALL_INFIELD_GLOVE, price: 150 })).toBe(0);
  });

  it("is positive above the ceiling", () => {
    const p = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMin: 0, budgetMax: 100 };
    expect(budgetDistance(p, { ...BASEBALL_INFIELD_GLOVE, price: 175 })).toBe(75);
  });

  it("is positive below the floor", () => {
    const p = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMin: 200, budgetMax: 400 };
    expect(budgetDistance(p, { ...BASEBALL_INFIELD_GLOVE, price: 150 })).toBe(50);
  });
});

describe("anyGloveInBudget", () => {
  it("is true when at least one glove fits", () => {
    const p = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMin: 0, budgetMax: 1000 };
    expect(anyGloveInBudget(p, SAMPLE_CATALOG)).toBe(true);
  });

  it("is false when none fit", () => {
    expect(anyGloveInBudget(STINGY_PROFILE, SAMPLE_CATALOG)).toBe(false);
  });
});

describe("rankGloves — budget soft-filter regression", () => {
  it("still returns matches when no glove fits the budget", () => {
    const results = rankGloves(STINGY_PROFILE, SAMPLE_CATALOG, 3);
    expect(results.length).toBeGreaterThan(0);
  });

  it("never returns an empty list just because of budget", () => {
    const extremeProfile = {
      ...ADULT_INFIELD_BASEBALL_PROFILE,
      budgetMax: 1,
      budgetMin: 0,
    };
    const results = rankGloves(extremeProfile, SAMPLE_CATALOG, 3);
    expect(results.length).toBeGreaterThan(0);
  });
});
