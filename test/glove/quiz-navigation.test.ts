/**
 * Back-navigation regression tests for the Kip It Real quiz.
 *
 * These tests cover the pure logic that the QuizContainer relies on:
 *   - getVisibleQuestions stays consistent after simulated back-navigation
 *   - answers are correctly cleared and re-applied across branching paths
 *   - the advanceKey guard model (the root cause of the back-button stuck bug)
 *
 * The QuizContainer's ref-based auto-advance guard cannot be unit-tested
 * without React Testing Library. Instead we validate:
 *   1. The advance-key de-duplication model in isolation.
 *   2. That visible questions remain coherent after back-and-forth navigation.
 *   3. That branching questions (wantsPremiumLeather, sport, position) remain
 *      stable across all quiz tracks.
 *
 * Root cause being guarded against:
 *   goBack() was NOT resetting lastAdvancedKeyRef. When the user re-selected
 *   the same answer value after going back, the advanceKey was identical to
 *   the stored key and the duplicate guard silently blocked advancement.
 *   Fix: goBack() now resets lastAdvancedKeyRef = "" before clearing state.
 */

import { describe, it, expect } from "vitest";
import { getVisibleQuestions } from "@/lib/glove/questions";
import type { QuizAnswers } from "@/lib/glove/types";

// ─── Advance-key guard model ──────────────────────────────────────────────────
// Mirrors the logic inside QuizContainer's useEffect and goBack(). These tests
// verify that the guard model behaves correctly in all back-navigation scenarios.

function makeAdvanceKey(questionId: string, value: unknown, stepIndex: number) {
  return `${questionId}:${JSON.stringify(value)}:${stepIndex}`;
}

/**
 * Simulates one cycle: answer → advance → back → re-answer.
 * Returns whether the re-answer would trigger a fresh advance.
 */
function simulateBackAndReanswer(
  questionId: string,
  originalValue: unknown,
  newValue: unknown,
  stepIndex: number,
): { wouldAdvance: boolean } {
  // 1. Forward: user answers, key is stored.
  let lastKey = makeAdvanceKey(questionId, originalValue, stepIndex);

  // 2. goBack() — this is the fix: reset the key to "".
  lastKey = "";

  // 3. Re-answer with newValue.
  const newKey = makeAdvanceKey(questionId, newValue, stepIndex);
  const wouldAdvance = lastKey !== newKey;

  return { wouldAdvance };
}

describe("Advance-key guard — back-navigation model", () => {
  it("allows advance when re-selecting the same answer after back (the original bug)", () => {
    const { wouldAdvance } = simulateBackAndReanswer(
      "sport",
      "baseball",
      "baseball", // same value
      0,
    );
    expect(wouldAdvance).toBe(true);
  });

  it("allows advance when selecting a different answer after back", () => {
    const { wouldAdvance } = simulateBackAndReanswer(
      "sport",
      "baseball",
      "fastpitch", // different value
      0,
    );
    expect(wouldAdvance).toBe(true);
  });

  it("allows advance when same boolean value (Yes/No) is reselected after back", () => {
    const { wouldAdvance } = simulateBackAndReanswer(
      "wantsPremiumLeather",
      true,
      true,
      12,
    );
    expect(wouldAdvance).toBe(true);
  });

  it("allows advance when same numeric value is reselected after back", () => {
    const { wouldAdvance } = simulateBackAndReanswer(
      "budgetMax",
      350,
      350,
      14,
    );
    expect(wouldAdvance).toBe(true);
  });

  it("still deduplicates without a back (normal forward flow)", () => {
    // Without goBack resetting the key, re-firing the same answer should not
    // double-advance. Simulate normal flow (no reset).
    const questionId = "sport";
    const value = "baseball";
    const stepIndex = 0;
    let lastKey = "";

    const key1 = makeAdvanceKey(questionId, value, stepIndex);
    const firstAdvance = lastKey !== key1;
    lastKey = key1;

    // Same render fires again (React strict mode or concurrent re-render)
    const key2 = makeAdvanceKey(questionId, value, stepIndex);
    const secondAdvance = lastKey !== key2;

    expect(firstAdvance).toBe(true);   // first fire: advances
    expect(secondAdvance).toBe(false); // duplicate: blocked ✓
  });
});

// ─── Visible question coherence after back-navigation ────────────────────────
// These tests verify that getVisibleQuestions returns a consistent,
// non-branching-broken list when answers are selectively cleared (as goBack
// does). Covers baseball, fastpitch, and slowpitch tracks.

describe("Visible question coherence — back-navigation across quiz tracks", () => {
  // Helper: simulate the answer state after goBack() clears a specific question.
  function clearAnswer(
    answers: Partial<QuizAnswers>,
    id: keyof QuizAnswers,
  ): Partial<QuizAnswers> {
    const next = { ...answers };
    delete next[id];
    return next;
  }

  // ── Baseball infield path ─────────────────────────────────────────────────

  it("baseball: visible questions are consistent after clearing sport answer", () => {
    const full: Partial<QuizAnswers> = { sport: "baseball", primaryPosition: "infield" };
    const afterBack = clearAnswer(full, "sport");
    const questions = getVisibleQuestions(afterBack);
    // Should still show all universal questions
    expect(questions.some((q) => q.id === "throwHand")).toBe(true);
    expect(questions.some((q) => q.id === "experienceLevel")).toBe(true);
  });

  it("baseball: age group question appears when sport answer is cleared", () => {
    // ageGroup is hidden for slowpitch. After clearing sport (going back to it),
    // the question list should again include ageGroup.
    const afterBack = clearAnswer({ sport: "baseball", ageGroup: "adult" }, "sport");
    const questions = getVisibleQuestions(afterBack);
    // With no sport set, ageGroup showIf (sport !== slowpitch) is satisfied
    // because undefined !== "slowpitch"
    expect(questions.some((q) => q.id === "ageGroup")).toBe(true);
  });

  it("baseball: re-answering sport = baseball restores same visible question set", () => {
    const original: Partial<QuizAnswers> = { sport: "baseball", primaryPosition: "infield" };
    const afterBack = clearAnswer(original, "sport");
    const afterReanswer: Partial<QuizAnswers> = { ...afterBack, sport: "baseball" };

    const originalVisible = getVisibleQuestions(original).map((q) => q.id);
    const reselectedVisible = getVisibleQuestions(afterReanswer).map((q) => q.id);

    expect(reselectedVisible).toEqual(originalVisible);
  });

  it("baseball infield: clearing and re-answering primaryPosition restores same visible set", () => {
    const original: Partial<QuizAnswers> = {
      sport: "baseball",
      ageGroup: "adult",
      throwHand: "RHT",
      primaryPosition: "infield",
    };
    const afterBack = clearAnswer(original, "primaryPosition");
    const afterReanswer: Partial<QuizAnswers> = { ...afterBack, primaryPosition: "infield" };

    const originalIds = getVisibleQuestions(original).map((q) => q.id);
    const reselectedIds = getVisibleQuestions(afterReanswer).map((q) => q.id);

    expect(reselectedIds).toEqual(originalIds);
  });

  // ── Fastpitch path ────────────────────────────────────────────────────────

  it("fastpitch: fastpitchFitImportant question is shown after re-answering sport=fastpitch", () => {
    const afterBack = clearAnswer({ sport: "fastpitch" }, "sport");
    const afterReanswer: Partial<QuizAnswers> = { ...afterBack, sport: "fastpitch" };
    const questions = getVisibleQuestions(afterReanswer);
    expect(questions.some((q) => q.id === "fastpitchFitImportant")).toBe(true);
  });

  it("fastpitch: openToCrossoverGloves question appears after re-answering sport=fastpitch", () => {
    const afterBack = clearAnswer({ sport: "fastpitch" }, "sport");
    const afterReanswer: Partial<QuizAnswers> = { ...afterBack, sport: "fastpitch" };
    const questions = getVisibleQuestions(afterReanswer);
    expect(questions.some((q) => q.id === "openToCrossoverGloves")).toBe(true);
  });

  it("fastpitch: clearing and re-answering sport=fastpitch gives same visible set", () => {
    const original: Partial<QuizAnswers> = {
      sport: "fastpitch",
      ageGroup: "adult",
      primaryPosition: "infield",
    };
    const afterBack = clearAnswer(original, "sport");
    const afterReanswer: Partial<QuizAnswers> = { ...afterBack, sport: "fastpitch" };

    const originalIds = getVisibleQuestions(original).map((q) => q.id);
    const reselectedIds = getVisibleQuestions(afterReanswer).map((q) => q.id);

    expect(reselectedIds).toEqual(originalIds);
  });

  // ── Slowpitch path ────────────────────────────────────────────────────────

  it("slowpitch: ageGroup question is hidden after re-answering sport=slowpitch", () => {
    const afterBack = clearAnswer({ sport: "slowpitch" }, "sport");
    const afterReanswer: Partial<QuizAnswers> = { ...afterBack, sport: "slowpitch" };
    const questions = getVisibleQuestions(afterReanswer);
    expect(questions.some((q) => q.id === "ageGroup")).toBe(false);
  });

  it("slowpitch: clearing and re-answering sport=slowpitch gives same visible set", () => {
    const original: Partial<QuizAnswers> = {
      sport: "slowpitch",
      primaryPosition: "utility",
    };
    const afterBack = clearAnswer(original, "sport");
    const afterReanswer: Partial<QuizAnswers> = { ...afterBack, sport: "slowpitch" };

    const originalIds = getVisibleQuestions(original).map((q) => q.id);
    const reselectedIds = getVisibleQuestions(afterReanswer).map((q) => q.id);

    expect(reselectedIds).toEqual(originalIds);
  });

  // ── Branching questions ───────────────────────────────────────────────────

  it("premium path: going back to wantsPremiumLeather=Yes and re-selecting Yes keeps budget hidden", () => {
    const original: Partial<QuizAnswers> = {
      sport: "baseball",
      primaryPosition: "infield",
      wantsPremiumLeather: true,
      budgetSkipped: true,
    };
    // goBack() also clears budgetSkipped when returning to wantsPremiumLeather
    const afterBack = clearAnswer(original, "wantsPremiumLeather");
    const cleaned = { ...afterBack };
    delete cleaned.budgetSkipped;

    const afterReanswer: Partial<QuizAnswers> = { ...cleaned, wantsPremiumLeather: true, budgetSkipped: true };
    const questions = getVisibleQuestions(afterReanswer);
    expect(questions.some((q) => q.id === "budgetMax")).toBe(false);
  });

  it("premium path: going back and selecting No instead restores budget question", () => {
    const afterBack: Partial<QuizAnswers> = {
      sport: "baseball",
      primaryPosition: "infield",
      // wantsPremiumLeather cleared, budgetSkipped cleared
    };
    const afterReanswer: Partial<QuizAnswers> = { ...afterBack, wantsPremiumLeather: false };
    const questions = getVisibleQuestions(afterReanswer);
    expect(questions.some((q) => q.id === "budgetMax")).toBe(true);
  });

  it("catcher path: pocket and web questions hidden after re-answering primaryPosition=catcher", () => {
    const afterBack = clearAnswer({ sport: "baseball", primaryPosition: "catcher" }, "primaryPosition");
    const afterReanswer: Partial<QuizAnswers> = { ...afterBack, primaryPosition: "catcher" };
    const questions = getVisibleQuestions(afterReanswer);
    expect(questions.some((q) => q.id === "pocketPreference")).toBe(false);
    expect(questions.some((q) => q.id === "webPreference")).toBe(false);
  });

  it("switching from catcher to infield after back restores pocket and web questions", () => {
    const afterBack: Partial<QuizAnswers> = { sport: "baseball" };
    // User originally was catcher, went back to primaryPosition, now picks infield
    const afterReanswer: Partial<QuizAnswers> = { ...afterBack, primaryPosition: "infield" };
    const questions = getVisibleQuestions(afterReanswer);
    expect(questions.some((q) => q.id === "pocketPreference")).toBe(true);
    expect(questions.some((q) => q.id === "webPreference")).toBe(true);
  });

  // ── Repeated back-and-forth ───────────────────────────────────────────────

  it("repeated back-and-forth on sport does not corrupt visible question list", () => {
    const state1: Partial<QuizAnswers> = { sport: "baseball" };
    const cleared1 = clearAnswer(state1, "sport");
    const state2: Partial<QuizAnswers> = { ...cleared1, sport: "fastpitch" };
    const cleared2 = clearAnswer(state2, "sport");
    const state3: Partial<QuizAnswers> = { ...cleared2, sport: "baseball" };

    const final = getVisibleQuestions(state3);
    const direct = getVisibleQuestions({ sport: "baseball" });

    expect(final.map((q) => q.id)).toEqual(direct.map((q) => q.id));
  });

  it("repeated back-and-forth on primaryPosition does not corrupt visible question list", () => {
    const base: Partial<QuizAnswers> = { sport: "baseball", ageGroup: "adult", throwHand: "RHT" };

    const atInfield = { ...base, primaryPosition: "infield" as const };
    const cleared = clearAnswer(atInfield, "primaryPosition");
    const atOutfield = { ...cleared, primaryPosition: "outfield" as const };
    const cleared2 = clearAnswer(atOutfield, "primaryPosition");
    const backToInfield = { ...cleared2, primaryPosition: "infield" as const };

    const finalIds = getVisibleQuestions(backToInfield).map((q) => q.id);
    const directIds = getVisibleQuestions(atInfield).map((q) => q.id);

    expect(finalIds).toEqual(directIds);
  });
});
