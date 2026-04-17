import { describe, it, expect } from "vitest";
import { scoreGlove, rankGloves } from "@/lib/glove/scoring";
import { weightsForSport } from "@/lib/glove/weights";
import {
  ADULT_INFIELD_BASEBALL_PROFILE,
  ADULT_OUTFIELD_BASEBALL_PROFILE,
  YOUTH_INFIELD_BASEBALL_PROFILE,
  FASTPITCH_PROFILE,
  BASEBALL_INFIELD_GLOVE,
  BASEBALL_OUTFIELD_GLOVE,
  FASTPITCH_GLOVE,
  BUDGET_GLOVE,
  SAMPLE_CATALOG,
} from "../fixtures";

const BB_WEIGHTS = weightsForSport("baseball");
const FP_WEIGHTS = weightsForSport("fastpitch");

// ─── scoreGlove ───────────────────────────────────────────────────────────────

describe("scoreGlove", () => {
  it("returns a score in [0, 100]", () => {
    const result = scoreGlove(
      ADULT_INFIELD_BASEBALL_PROFILE,
      BASEBALL_INFIELD_GLOVE,
      BB_WEIGHTS,
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("returns a breakdown with one item per active dimension", () => {
    const result = scoreGlove(
      ADULT_INFIELD_BASEBALL_PROFILE,
      BASEBALL_INFIELD_GLOVE,
      BB_WEIGHTS,
    );
    // We have 12 dimensions; baseball weights set fastpitchFitImportance to 0
    // so it should be skipped — expect at least 10 breakdown items
    expect(result.breakdown.length).toBeGreaterThanOrEqual(10);
  });

  it("each breakdown item has value in [0, 1]", () => {
    const result = scoreGlove(
      ADULT_INFIELD_BASEBALL_PROFILE,
      BASEBALL_INFIELD_GLOVE,
      BB_WEIGHTS,
    );
    for (const item of result.breakdown) {
      expect(item.value).toBeGreaterThanOrEqual(0);
      expect(item.value).toBeLessThanOrEqual(1);
    }
  });

  it("scores a well-matched glove higher than a poorly matched one", () => {
    const infield = scoreGlove(
      ADULT_INFIELD_BASEBALL_PROFILE,
      BASEBALL_INFIELD_GLOVE, // infield glove for infield player
      BB_WEIGHTS,
    );
    const outfield = scoreGlove(
      ADULT_INFIELD_BASEBALL_PROFILE,
      BASEBALL_OUTFIELD_GLOVE, // outfield glove for infield player
      BB_WEIGHTS,
    );
    expect(infield.score).toBeGreaterThan(outfield.score);
  });

  it("applies a penalty for a glove above budget", () => {
    const tight = {
      ...ADULT_INFIELD_BASEBALL_PROFILE,
      budgetMax: 150, // infield glove is $299
    };
    const loose = ADULT_INFIELD_BASEBALL_PROFILE;
    const penalised = scoreGlove(tight, BASEBALL_INFIELD_GLOVE, BB_WEIGHTS);
    const normal = scoreGlove(loose, BASEBALL_INFIELD_GLOVE, BB_WEIGHTS);
    expect(penalised.score).toBeLessThan(normal.score);
  });

  it("scores a youth-friendly glove higher for a youth player", () => {
    const youthBudget = scoreGlove(
      YOUTH_INFIELD_BASEBALL_PROFILE,
      BUDGET_GLOVE, // youthFriendly: true
      BB_WEIGHTS,
    );
    const youthPremium = scoreGlove(
      YOUTH_INFIELD_BASEBALL_PROFILE,
      BASEBALL_INFIELD_GLOVE, // youthFriendly: false
      BB_WEIGHTS,
    );
    // Budget glove is youth-friendly; premium is not — expect better youthFriendliness score
    const youthBudgetDim = youthBudget.breakdown.find(
      (b) => b.key === "youthFriendliness",
    );
    const youthPremiumDim = youthPremium.breakdown.find(
      (b) => b.key === "youthFriendliness",
    );
    expect(youthBudgetDim?.value).toBeGreaterThan(youthPremiumDim?.value ?? 0);
  });

  it("rewards fastpitch-specific glove for fastpitch player with fitImportant=true", () => {
    const fpGloveFit = scoreGlove(
      FASTPITCH_PROFILE,
      { ...FASTPITCH_GLOVE, fastpitchFit: true },
      FP_WEIGHTS,
    );
    const fpGloveNoFit = scoreGlove(
      FASTPITCH_PROFILE,
      { ...FASTPITCH_GLOVE, fastpitchFit: false },
      FP_WEIGHTS,
    );
    expect(fpGloveFit.score).toBeGreaterThan(fpGloveNoFit.score);
  });

  it("returns empty reasons, tradeoffs, and avoidIf arrays", () => {
    const result = scoreGlove(
      ADULT_INFIELD_BASEBALL_PROFILE,
      BASEBALL_INFIELD_GLOVE,
      BB_WEIGHTS,
    );
    // scoreGlove doesn't attach explanations — those come from rankGloves
    expect(result.reasons).toEqual([]);
    expect(result.tradeoffs).toEqual([]);
    expect(result.avoidIf).toEqual([]);
  });
});

// ─── rankGloves ──────────────────────────────────────────────────────────────

describe("rankGloves", () => {
  it("returns at most topN results (default 3)", () => {
    const results = rankGloves(ADULT_INFIELD_BASEBALL_PROFILE, SAMPLE_CATALOG);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("respects a custom topN", () => {
    const results = rankGloves(ADULT_INFIELD_BASEBALL_PROFILE, SAMPLE_CATALOG, 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("returns results in descending score order", () => {
    const results = rankGloves(ADULT_INFIELD_BASEBALL_PROFILE, SAMPLE_CATALOG);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }
  });

  it("populates explanations on each result", () => {
    const results = rankGloves(ADULT_INFIELD_BASEBALL_PROFILE, SAMPLE_CATALOG);
    for (const r of results) {
      expect(r.reasons.length).toBeGreaterThanOrEqual(1);
      expect(r.tradeoffs.length).toBeGreaterThanOrEqual(1);
      expect(r.avoidIf.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns empty array when no gloves pass hard filters", () => {
    // Only fastpitch + catcher gloves in catalog — no match for baseball infield
    const catalog = [FASTPITCH_GLOVE, BUDGET_GLOVE]; // BUDGET_GLOVE is baseball
    const results = rankGloves(
      { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMax: 50 }, // too low for budget glove ($89)
      [FASTPITCH_GLOVE], // only fastpitch — wrong sport
    );
    expect(results).toHaveLength(0);
  });

  it("best result has a higher score than the rest", () => {
    const results = rankGloves(ADULT_OUTFIELD_BASEBALL_PROFILE, SAMPLE_CATALOG);
    if (results.length > 1) {
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    }
  });
});
