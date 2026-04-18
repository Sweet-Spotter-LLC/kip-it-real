"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  QUIZ_QUESTIONS,
  getVisibleQuestions,
  resolveQuestionOptions,
} from "@/lib/glove/questions";
import type {
  QuizAnswers,
  QuizQuestion,
  QuizQuestionOption,
} from "@/lib/glove/types";
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
 *   6. The Kip It Real? fork: selecting "Yes" drops the budget question
 *      out of the visible list (via its showIf) and auto-submits the quiz
 *      since that question is then the final one.
 */
export function QuizContainer() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Guard so auto-advance only fires once per answer change.
  const lastAdvancedKeyRef = useRef<string>("");

  // Suppression flag set when the user explicitly clicks Back — prevents the
  // auto-advance effect from immediately ricocheting forward again because
  // the previous step's answer is still populated. Cleared on the next user
  // interaction (selecting a different answer).
  const suppressAdvanceRef = useRef(false);

  // Recompute visible questions on every render — branching happens here.
  const visibleQuestions = useMemo(
    () => getVisibleQuestions(answers),
    [answers],
  );
  const totalSteps = visibleQuestions.length || QUIZ_QUESTIONS.length;
  const current = visibleQuestions[stepIndex];

  // Dynamic options (e.g. position-filtered web choices) are resolved here
  // so the input renderer stays dumb — it just renders what it's given.
  const currentOptions: QuizQuestionOption[] | undefined = useMemo(
    () => (current ? resolveQuestionOptions(current, answers) : undefined),
    [current, answers],
  );

  // ── Answer setter ────────────────────────────────────────────────────────
  function setAnswer(key: keyof QuizAnswers, value: unknown) {
    // Any new selection clears the back-suppression — selecting an answer is
    // an intentional forward action.
    suppressAdvanceRef.current = false;

    setAnswers((prev) => {
      const next: Partial<QuizAnswers> = { ...prev, [key]: value } as Partial<QuizAnswers>;

      // Kip it Real? fork — flipping this answer carries a side effect on
      // the budget fields. Yes => skip budget; No => clear the skip flag so
      // the budget question re-appears with a clean slate.
      if (key === "wantsPremiumLeather") {
        if (value === true) {
          next.budgetSkipped = true;
          // Drop any prior budget so the profile builder uses the
          // premium-path sentinel instead of a stale selection.
          delete next.budgetMin;
          delete next.budgetMax;
        } else {
          next.budgetSkipped = false;
        }
      }

      return next;
    });
  }

  // ── Navigation ──────────────────────────────────────────────────────────
  function goBack() {
    suppressAdvanceRef.current = true;
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function submitAnswers(overrides?: Partial<QuizAnswers>) {
    setSubmitting(true);
    try {
      const payload = overrides ? { ...answers, ...overrides } : answers;
      sessionStorage.setItem(
        "kip-quiz-answers",
        JSON.stringify(payload),
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

    // If the user just clicked Back, the previous step's answer is still in
    // state — without this guard the effect would treat that as a fresh
    // selection and immediately fire the timer to push them forward again.
    // Record the current key as "already advanced" so subsequent renders stay
    // idempotent until the user makes a new selection (which clears the
    // suppression flag in setAnswer()).
    if (suppressAdvanceRef.current) {
      lastAdvancedKeyRef.current = advanceKey;
      suppressAdvanceRef.current = false;
      return;
    }

    if (lastAdvancedKeyRef.current === advanceKey) return;
    lastAdvancedKeyRef.current = advanceKey;

    // ── Kip it Real? premium path: auto-submit on Yes ─────────────────────
    // When the user picks Yes, the budget question drops out of
    // visibleQuestions (via its showIf), making this question the last one.
    // The spec says: "Proceed directly to the Results page" — we honour
    // that by submitting instead of waiting for another tap.
    if (
      current.id === "wantsPremiumLeather" &&
      answerForCurrent === true &&
      stepIndex === visibleQuestions.length - 1
    ) {
      const timer = setTimeout(() => {
        submitAnswers();
      }, 420);
      return () => clearTimeout(timer);
    }

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
    // submitAnswers depends on `answers` so the effect deps already cover it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const currentAnswer = answers[current.id as keyof QuizAnswers];
  const hasAnswer = currentAnswer !== undefined;
  const isLast = stepIndex === visibleQuestions.length - 1;
  const isMultiSelect = current.type === "brand_picker";

  // Premium-path: when Yes is picked we suppress the manual "Show my matches"
  // button since we auto-submit. When No is picked we show a reassurance
  // note explaining that the budget question is still coming.
  const isKipItRealQuestion = current.id === "wantsPremiumLeather";
  const kipItRealYes = isKipItRealQuestion && currentAnswer === true;
  const kipItRealNo = isKipItRealQuestion && currentAnswer === false;

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

        {/* Warning callout — used by the Kip it Real? fork and any future
            high-stakes questions that need an explicit disclaimer. */}
        {current.warning && (
          <div
            role="note"
            className="mt-4 rounded-2xl border border-brand-accent/40 bg-brand-accent/10 p-4 text-sm leading-relaxed text-brand-text"
          >
            {current.warning}
          </div>
        )}

        <div className="mt-8">
          <QuestionInput
            question={current}
            options={currentOptions}
            value={currentAnswer}
            onChange={(v) => setAnswer(current.id as keyof QuizAnswers, v)}
          />
        </div>

        {/* Kip it Real? No-path reassurance — spec copy verbatim. */}
        {kipItRealNo && (
          <p className="mt-5 text-sm leading-relaxed text-brand-support">
            No problem. We&rsquo;ll find the best-performing matches within
            your specific budget in the next step.
          </p>
        )}

        {/* Kip it Real? Yes-path confirmation — explains the auto-submit. */}
        {kipItRealYes && (
          <p className="mt-5 text-sm leading-relaxed text-brand-primary font-semibold">
            Locking in the premium path — optimizing for elite leather…
          </p>
        )}
      </div>

      {/* ── Nav buttons ─────────────────────────────────────────────────
          We always show Back. The primary CTA only shows on the last step
          OR on multi-select steps (brand picker) where the user must
          confirm their selection. When Kip it Real = Yes we suppress the
          CTA entirely since the auto-submit is already in flight.          */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0 || submitting}
          className="btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>

        {!kipItRealYes && (isLast || isMultiSelect) && (
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
            hint so the user isn't confused by the missing Next button.
            Also used during the Kip it Real auto-submit delay.            */}
        {(!isLast && !isMultiSelect) && (
          <span className="text-xs text-brand-support">
            {hasAnswer ? "Advancing…" : "Select to continue"}
          </span>
        )}
        {kipItRealYes && (
          <span className="text-xs font-semibold text-brand-primary">
            Showing your matches…
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Input renderer ──────────────────────────────────────────────────────────

interface QuestionInputProps {
  question: QuizQuestion;
  /**
   * Options to render — resolved by the container so dynamic
   * (position-filtered) questions work correctly. Falls back to
   * question.options when undefined.
   */
  options?: QuizQuestionOption[];
  value: unknown;
  onChange: (v: unknown) => void;
}

function QuestionInput({
  question,
  options,
  value,
  onChange,
}: QuestionInputProps) {
  const opts = options ?? question.options ?? [];

  // Brand picker = multi-select chips
  if (question.type === "brand_picker") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map((opt) => {
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
      {opts.map((opt) => {
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
