"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  QUIZ_QUESTIONS,
  getVisibleQuestions,
} from "@/lib/glove/questions";
import type { QuizAnswers, QuizQuestion } from "@/lib/glove/types";
import { ProgressBar } from "./ProgressBar";

/**
 * Kip It Real — client-side quiz container.
 *
 * State flow:
 *   1. Answers accumulate in local state.
 *   2. Visible questions are recomputed on every render from the answers —
 *      this is how branching works without hardcoded page logic.
 *   3. For single-select / range / boolean questions, selecting an answer
 *      auto-advances to the next question after a short delay.
 *   4. For the brand picker (multi-select) the user must confirm with the
 *      primary button since they may want to add or clear selections.
 *   5. On the final step, answers are stored in sessionStorage and we
 *      navigate to /results, which reads them back and calls /api/gloves.
 */
export function QuizContainer() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Guard so auto-advance only fires once per answer change.
  const lastAdvancedKeyRef = useRef<string>("");

  // Recompute visible questions on every render — branching happens here.
  const visibleQuestions = useMemo(
    () => getVisibleQuestions(answers),
    [answers],
  );
  const totalSteps = visibleQuestions.length || QUIZ_QUESTIONS.length;
  const current = visibleQuestions[stepIndex];

  // ── Answer setter ────────────────────────────────────────────────────────
  function setAnswer(key: keyof QuizAnswers, value: unknown) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  // ── Navigation ──────────────────────────────────────────────────────────
  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1));
    // Reset the advance guard when going back so re-selecting auto-advances.
    lastAdvancedKeyRef.current = "";
  }

  async function submitAnswers() {
    setSubmitting(true);
    try {
      sessionStorage.setItem(
        "kip-quiz-answers",
        JSON.stringify(answers),
      );
      router.push("/results");
    } catch (err) {
      console.error("Failed to store quiz answers", err);
      setSubmitting(false);
    }
  }

  // ── Auto-advance effect ──────────────────────────────────────────────────
  // Fires whenever the user sets an answer on a single-choice question.
  // Brand picker (multi-select) is excluded — user confirms manually.
  useEffect(() => {
    if (!current) return;

    const answerForCurrent = answers[current.id as keyof QuizAnswers];
    if (answerForCurrent === undefined) return;

    // Brand picker is multi-select — never auto-advance.
    if (current.type === "brand_picker") return;

    // Build a stable key so we only auto-advance once per (question, value).
    const advanceKey = `${current.id}:${JSON.stringify(answerForCurrent)}:${stepIndex}`;
    if (lastAdvancedKeyRef.current === advanceKey) return;
    lastAdvancedKeyRef.current = advanceKey;

    // If we're on the last step, don't auto-submit. Let the user tap the
    // confirm CTA intentionally.
    if (stepIndex >= visibleQuestions.length - 1) return;

    // Small delay so the user sees their selection highlighted briefly.
    const timer = setTimeout(() => {
      setStepIndex((i) =>
        i < visibleQuestions.length - 1 ? i + 1 : i,
      );
    }, 280);

    return () => clearTimeout(timer);
  }, [answers, current, stepIndex, visibleQuestions]);

  // ── Guard — no question (shouldn't happen, but defensive) ───────────────
  if (!current) {
    return (
      <div className="card text-center">
        <p className="text-brand-support">
          No question available. Please reload to start over.
        </p>
      </div>
    );
  }

  const hasAnswer = answers[current.id as keyof QuizAnswers] !== undefined;
  const isLast = stepIndex === visibleQuestions.length - 1;
  const isMultiSelect = current.type === "brand_picker";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <ProgressBar current={stepIndex + 1} total={totalSteps} />

      {/* ── Question card ─────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-brand-primary">
          {current.label}
        </h2>
        {current.description && (
          <p className="mt-3 text-sm md:text-base leading-relaxed text-brand-support">
            {current.description}
          </p>
        )}

        <div className="mt-8">
          <QuestionInput
            question={current}
            value={answers[current.id as keyof QuizAnswers]}
            onChange={(v) => setAnswer(current.id as keyof QuizAnswers, v)}
          />
        </div>
      </div>

      {/* ── Nav buttons ─────────────────────────────────────────────────
          We always show Back. The primary CTA only shows on the last step
          OR on multi-select steps (brand picker) where the user must
          confirm their selection.                                         */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0}
          className="btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>

        {(isLast || isMultiSelect) && (
          <button
            type="button"
            onClick={() => {
              if (isLast) {
                submitAnswers();
              } else {
                setStepIndex((i) => i + 1);
              }
            }}
            disabled={(!hasAnswer && !isMultiSelect) || submitting}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Finding your matches…"
              : isLast
              ? "Show my matches"
              : "Next →"}
          </button>
        )}

        {/* On non-last single-choice steps, show a subtle "auto-advancing"
            hint so the user isn't confused by the missing Next button. */}
        {!isLast && !isMultiSelect && (
          <span className="text-xs text-brand-support">
            {hasAnswer ? "Advancing…" : "Select to continue"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Input renderer ──────────────────────────────────────────────────────────

interface QuestionInputProps {
  question: QuizQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
}

function QuestionInput({ question, value, onChange }: QuestionInputProps) {
  // Brand picker = multi-select chips
  if (question.type === "brand_picker") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-2">
        {question.options?.map((opt) => {
          const isSelected = selected.includes(opt.value as string);
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() =>
                onChange(
                  isSelected
                    ? selected.filter((v) => v !== opt.value)
                    : [...selected, opt.value as string],
                )
              }
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition-all",
                "border-2",
                isSelected
                  ? "border-brand-primary bg-brand-primary text-brand-bg"
                  : "border-brand-bg-deep bg-white/60 text-brand-text hover:border-brand-accent",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onChange([])}
          className="btn-ghost text-xs"
        >
          Skip — I&rsquo;m open
        </button>
      </div>
    );
  }

  // Boolean = yes/no pair
  if (question.type === "boolean") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Yes", value: true },
          { label: "No", value: false },
        ].map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                "rounded-2xl border-2 px-6 py-4 text-base font-semibold transition-all text-left",
                isSelected
                  ? "border-brand-primary bg-brand-primary text-brand-bg shadow-card"
                  : "border-brand-bg-deep bg-white/60 text-brand-text hover:border-brand-accent",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  // single_select and range both render as a list of radio-style cards.
  return (
    <div className="flex flex-col gap-3">
      {question.options?.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "w-full rounded-2xl border-2 px-5 py-4 text-left transition-all",
              isSelected
                ? "border-brand-primary bg-brand-primary text-brand-bg shadow-card"
                : "border-brand-bg-deep bg-white/60 text-brand-text hover:border-brand-accent hover:shadow-card",
            ].join(" ")}
          >
            <span className="font-semibold">{opt.label}</span>
            {opt.hint && (
              <span
                className={[
                  "mt-1 block text-xs",
                  isSelected ? "text-brand-bg/80" : "text-brand-support",
                ].join(" ")}
              >
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
