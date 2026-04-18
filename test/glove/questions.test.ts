/**
 * Tests for the refactored Kip It Real quiz configuration.
 *
 * Covers:
 *   - Web options are position-filtered (and labeled when mixed).
 *   - Fast-close is gated to Infield / Utility.
 *   - The "Kip it Real?" premium path hides the budget question.
 *   - Brand preference lives at step 13 (moved up from the final step).
 */

import { describe, it, expect } from "vitest";
import {
  QUIZ_QUESTIONS,
  getVisibleQuestions,
  resolveQuestionOptions,
} from "@/lib/glove/questions";
import type { QuizAnswers, QuizQuestion } from "@/lib/glove/types";

function questionById(id: string): QuizQuestion {
  const q = QUIZ_QUESTIONS.find((qq) => qq.id === id);
  if (!q) throw new Error(`Missing question: ${id}`);
  return q;
}

describe("Quiz question ordering & gating", () => {
  it("places Kip it Real (wantsPremiumLeather) second-to-last", () => {
    const premiumIdx = QUIZ_QUESTIONS.findIndex(
      (q) => q.id === "wantsPremiumLeather",
    );
    const budgetIdx = QUIZ_QUESTIONS.findIndex((q) => q.id === "budgetMax");
    expect(premiumIdx).toBeGreaterThan(-1);
    expect(budgetIdx).toBe(premiumIdx + 1);
  });

  it("places preferredBrands at step 13", () => {
    const brands = questionById("preferredBrands");
    expect(brands.step).toBe(13);
  });

  it("uses effort-focused phrasing on the break-in question", () => {
    const breakIn = questionById("breakInPreference");
    expect(breakIn.label.toLowerCase()).toContain("work");
  });
});

describe("Web-option filtering by position", () => {
  it("filters options to webs compatible with the primary position", () => {
    const web = questionById("webPreference");
    const opts = resolveQuestionOptions(web, {
      primaryPosition: "outfield",
    });
    expect(opts).toBeDefined();
    const values = opts!.map((o) => o.value);
    // Outfield-friendly webs
    expect(values).toContain("trap");
    expect(values).toContain("h_web");
    // Infield-only webs should not appear for a pure outfielder
    expect(values).not.toContain("two_piece_closed");
    // Escape hatch is always present
    expect(values).toContain("unsure");
  });

  it("labels webs with [Position Only] when compatibility is mixed", () => {
    const web = questionById("webPreference");
    const opts = resolveQuestionOptions(web, {
      primaryPosition: "infield",
      secondaryPosition: "outfield",
    });
    expect(opts).toBeDefined();
    const labels = opts!.map((o) => o.label);
    // I-Web fits infield but not outfield → should be labeled
    expect(labels.some((l) => /I-Web.*\[Infield Only\]/.test(l))).toBe(true);
    // Trap Web fits outfield but not infield → should be labeled
    expect(labels.some((l) => /Trap Web.*\[Outfield Only\]/.test(l))).toBe(
      true,
    );
    // H-Web fits both — no label
    expect(labels.some((l) => l === "H-Web")).toBe(true);
  });

  it("shows no constraint labels when user has only one position", () => {
    const web = questionById("webPreference");
    const opts = resolveQuestionOptions(web, {
      primaryPosition: "infield",
    });
    for (const o of opts ?? []) {
      expect(o.label).not.toMatch(/\[.*Only\]/);
    }
  });
});

describe("Fast-close question gating", () => {
  const base: Partial<QuizAnswers> = {
    sport: "baseball",
    primaryPosition: "infield",
  };

  it("is visible for infield", () => {
    const visible = getVisibleQuestions({ ...base, primaryPosition: "infield" });
    expect(visible.some((q) => q.id === "wantsFastClose")).toBe(true);
  });

  it("is visible for utility", () => {
    const visible = getVisibleQuestions({
      ...base,
      primaryPosition: "utility",
    });
    expect(visible.some((q) => q.id === "wantsFastClose")).toBe(true);
  });

  it("is hidden for outfield", () => {
    const visible = getVisibleQuestions({
      ...base,
      primaryPosition: "outfield",
    });
    expect(visible.some((q) => q.id === "wantsFastClose")).toBe(false);
  });

  it("is hidden for pitcher", () => {
    const visible = getVisibleQuestions({
      ...base,
      primaryPosition: "pitcher",
    });
    expect(visible.some((q) => q.id === "wantsFastClose")).toBe(false);
  });

  it("is hidden for catcher and first base (via mitt short-circuit)", () => {
    for (const pos of ["catcher", "first_base"] as const) {
      const visible = getVisibleQuestions({ ...base, primaryPosition: pos });
      expect(visible.some((q) => q.id === "wantsFastClose")).toBe(false);
    }
  });
});

describe("Kip it Real? — premium-path gating", () => {
  const infielder: Partial<QuizAnswers> = {
    sport: "baseball",
    primaryPosition: "infield",
  };

  it("hides the budget question when wantsPremiumLeather = true", () => {
    const visible = getVisibleQuestions({
      ...infielder,
      wantsPremiumLeather: true,
    });
    expect(visible.some((q) => q.id === "budgetMax")).toBe(false);
    // Premium leather itself is still visible — it's the fork, not the skip.
    expect(visible.some((q) => q.id === "wantsPremiumLeather")).toBe(true);
  });

  it("shows the budget question when wantsPremiumLeather = false", () => {
    const visible = getVisibleQuestions({
      ...infielder,
      wantsPremiumLeather: false,
    });
    expect(visible.some((q) => q.id === "budgetMax")).toBe(true);
  });

  it("still shows the budget question when premium is unanswered", () => {
    const visible = getVisibleQuestions(infielder);
    expect(visible.some((q) => q.id === "budgetMax")).toBe(true);
  });

  it("carries the warning disclaimer on the Kip it Real? question", () => {
    const q = questionById("wantsPremiumLeather");
    expect(q.warning).toBeDefined();
    expect(q.warning!.toLowerCase()).toContain("elite leather");
    expect(q.label).toBe("Kip it Real?");
  });
});
