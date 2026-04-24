import { describe, it, expect } from "vitest";
import { generateExplanation } from "@/lib/glove/explain";
import { scoreGlove } from "@/lib/glove/scoring";
import { weightsForSport } from "@/lib/glove/weights";
import {
  ADULT_INFIELD_BASEBALL_PROFILE,
  FASTPITCH_PROFILE,
  BASEBALL_INFIELD_GLOVE,
  FASTPITCH_GLOVE,
} from "../fixtures";

const BB_WEIGHTS = weightsForSport("baseball");
const FP_WEIGHTS = weightsForSport("fastpitch");

function explainFor(profile: typeof ADULT_INFIELD_BASEBALL_PROFILE, glove: typeof BASEBALL_INFIELD_GLOVE, weights = BB_WEIGHTS) {
  const { breakdown } = scoreGlove(profile, glove, weights);
  return generateExplanation(profile, glove, breakdown);
}

describe("generateExplanation", () => {
  // ── Volume requirements ──────────────────────────────────────────────────

  it("returns at least 3 reasons for a good match", () => {
    const { reasons } = explainFor(
      ADULT_INFIELD_BASEBALL_PROFILE,
      BASEBALL_INFIELD_GLOVE,
    );
    expect(reasons.length).toBeGreaterThanOrEqual(3);
  });

  it("returns at most 5 reasons", () => {
    const { reasons } = explainFor(
      ADULT_INFIELD_BASEBALL_PROFILE,
      BASEBALL_INFIELD_GLOVE,
    );
    expect(reasons.length).toBeLessThanOrEqual(5);
  });

  it("returns at least 1 tradeoff", () => {
    const { tradeoffs } = explainFor(
      ADULT_INFIELD_BASEBALL_PROFILE,
      BASEBALL_INFIELD_GLOVE,
    );
    expect(tradeoffs.length).toBeGreaterThanOrEqual(1);
  });

  it("returns at most 4 tradeoffs", () => {
    const { tradeoffs } = explainFor(
      ADULT_INFIELD_BASEBALL_PROFILE,
      BASEBALL_INFIELD_GLOVE,
    );
    expect(tradeoffs.length).toBeLessThanOrEqual(4);
  });

  // ── No filler language ───────────────────────────────────────────────────

  const FILLER_PHRASES = [
    "no major tradeoffs",
    "not a clear mismatch",
    "no significant issues",
    "works well overall",
  ];

  it("does not contain generic filler phrases in reasons", () => {
    const { reasons } = explainFor(
      ADULT_INFIELD_BASEBALL_PROFILE,
      BASEBALL_INFIELD_GLOVE,
    );
    for (const reason of reasons) {
      for (const filler of FILLER_PHRASES) {
        expect(reason.toLowerCase()).not.toContain(filler);
      }
    }
  });

  it("does not contain generic filler phrases in tradeoffs", () => {
    const { tradeoffs } = explainFor(
      ADULT_INFIELD_BASEBALL_PROFILE,
      BASEBALL_INFIELD_GLOVE,
    );
    for (const t of tradeoffs) {
      for (const filler of FILLER_PHRASES) {
        expect(t.toLowerCase()).not.toContain(filler);
      }
    }
  });

  // ── Context-specific content ─────────────────────────────────────────────

  it("mentions break-in when glove is stiff and player wants game-ready", () => {
    const gameReadyProfile = {
      ...ADULT_INFIELD_BASEBALL_PROFILE,
      breakInPreference: "game_ready" as const,
      breakInTolerance: 1,
    };
    const { tradeoffs } = explainFor(gameReadyProfile, BASEBALL_INFIELD_GLOVE); // stiffness: 4
    const combined = tradeoffs.join(" ").toLowerCase();
    expect(combined).toMatch(/break.in|stiff|conditioning/);
  });

  it("mentions size in a reason when glove size is within recommended range", () => {
    const { reasons } = explainFor(
      ADULT_INFIELD_BASEBALL_PROFILE, // range 11.25-11.75
      BASEBALL_INFIELD_GLOVE,         // size 11.75 — in range
    );
    const combined = reasons.join(" ").toLowerCase();
    expect(combined).toMatch(/11\.75|size|range/);
  });

  it("mentions fastpitch fit when player flagged it as important", () => {
    const { reasons } = explainFor(
      FASTPITCH_PROFILE,
      { ...FASTPITCH_GLOVE, sport: "fastpitch", fastpitchFit: true },
      FP_WEIGHTS,
    );
    const combined = reasons.join(" ").toLowerCase();
    expect(combined).toMatch(/fastpitch/);
  });

  // ── All strings are non-empty ────────────────────────────────────────────

  it("all returned strings are non-empty", () => {
    const { reasons, tradeoffs } = explainFor(
      ADULT_INFIELD_BASEBALL_PROFILE,
      BASEBALL_INFIELD_GLOVE,
    );
    for (const s of [...reasons, ...tradeoffs]) {
      expect(s.trim().length).toBeGreaterThan(0);
    }
  });

  // ── Price-gap solutioning (tradeoffs) ────────────────────────────────────

  it("small price gap suggests sales or last year's colorway", () => {
    // budgetMax 220, glove price 249 → 13% over (small).
    const p = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMax: 220, budgetMin: 150 };
    const g = { ...BASEBALL_INFIELD_GLOVE, price: 249 };
    const { tradeoffs } = explainFor(p, g);
    const combined = tradeoffs.join(" ").toLowerCase();
    expect(combined).toMatch(/sale|last year|colorway/);
  });

  it("medium price gap references amortisation or secondhand market", () => {
    // budgetMax 200, price 270 → 35% over (medium).
    const p = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMax: 200, budgetMin: 100 };
    const g = { ...BASEBALL_INFIELD_GLOVE, price: 270 };
    const { tradeoffs } = explainFor(p, g);
    const combined = tradeoffs.join(" ").toLowerCase();
    expect(combined).toMatch(/season|sidelineswap|lightly-used|per-season/);
  });

  it("large price gap points at the pre-owned or mid-grade alternative", () => {
    // budgetMax 100, price 300 → 200% over (large).
    const p = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMax: 100, budgetMin: 0 };
    const g = { ...BASEBALL_INFIELD_GLOVE, price: 300 };
    const { tradeoffs } = explainFor(p, g);
    const combined = tradeoffs.join(" ").toLowerCase();
    expect(combined).toMatch(/pre-owned|mid-grade|used/);
  });

  it("does not fire a price tradeoff when the glove is within budget", () => {
    const p = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMax: 500 };
    const g = { ...BASEBALL_INFIELD_GLOVE, price: 250 };
    const { tradeoffs } = explainFor(p, g);
    for (const t of tradeoffs) {
      expect(t.toLowerCase()).not.toMatch(/above your \$|past your \$|over your \$/);
    }
  });
});
