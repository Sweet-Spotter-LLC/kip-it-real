"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  QuizAnswers,
  GloveMatchResult,
  UserProfile,
  SizeRecommendation,
} from "@/lib/glove/types";
import { POSITION_LABELS, SPORT_LABELS } from "@/lib/glove/constants";
import { formatResultsAsText, buildMailtoUrl } from "@/lib/glove/share";
import { GloveCard } from "./GloveCard";

interface ApiResponse {
  results: GloveMatchResult[];
  profile: UserProfile;
  size: SizeRecommendation;
  /** True when NO glove in the sport catalog sits inside the user's budget. */
  budgetMismatch?: boolean;
}

/**
 * Kip It Real — results page client component.
 *
 * 1. Reads quiz answers from sessionStorage.
 * 2. POSTs them to /api/gloves.
 * 3. Renders the top matches, the size recommendation, and a way to retake.
 */
export function ResultsClient() {
  const router = useRouter();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; data: ApiResponse }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const stored = sessionStorage.getItem("kip-quiz-answers");
      if (!stored) {
        router.replace("/quiz");
        return;
      }

      let answers: QuizAnswers;
      try {
        answers = JSON.parse(stored);
      } catch {
        setState({
          status: "error",
          message: "Your quiz answers couldn't be read. Please retake the quiz.",
        });
        return;
      }

      try {
        const res = await fetch("/api/gloves", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(answers),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        const data = (await res.json()) as ApiResponse;
        if (!cancelled) setState({ status: "ready", data });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              err instanceof Error
                ? err.message
                : "Something went wrong computing your matches.",
          });
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error")
    return <ErrorState message={state.message} />;

  return <ReadyState {...state.data} />;
}

// ─── Loading ────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="card text-center animate-pulse">
      <p className="eyebrow">Scoring the catalog…</p>
      <p className="mt-4 font-display text-2xl text-brand-primary">
        Finding your best three.
      </p>
      <p className="mt-2 text-sm text-brand-support">
        Running your profile through the matching engine.
      </p>
    </div>
  );
}

// ─── Error ──────────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="card text-center">
      <p className="eyebrow text-brand-primary">Something went sideways</p>
      <p className="mt-4 font-display text-2xl text-brand-primary">
        We couldn&rsquo;t build your matches.
      </p>
      <p className="mt-3 text-sm text-brand-support">{message}</p>
      <Link href="/quiz" className="btn-primary mt-8">
        Retake the quiz
      </Link>
    </div>
  );
}

// ─── Ready ──────────────────────────────────────────────────────────────────

function ReadyState({ results, profile, size, budgetMismatch }: ApiResponse) {
  if (results.length === 0) {
    return (
      <div className="card text-center">
        <p className="eyebrow">No matches yet</p>
        <p className="mt-4 font-display text-2xl text-brand-primary">
          We don&rsquo;t have a glove that fits all your criteria.
        </p>
        <p className="mt-3 text-sm text-brand-support">
          Try widening your budget or opening up your position preferences.
        </p>
        <Link href="/quiz" className="btn-primary mt-8">
          Retake the quiz
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Profile summary ────────────────────────────────────────────── */}
      <section className="card">
        <p className="eyebrow">Your fit profile</p>
        <h1 className="mt-3 font-display text-3xl md:text-4xl font-bold text-brand-primary">
          {SPORT_LABELS[profile.sport]} ·{" "}
          {POSITION_LABELS[profile.primaryPosition]}
        </h1>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <MetaCell
            label="Recommended size"
            value={size.label}
            sub={size.reason}
          />
          <MetaCell
            label="Throwing hand"
            value={profile.throwHand === "RHT" ? "Right-handed" : "Left-handed"}
          />
          <MetaCell
            label="Budget ceiling"
            value={`$${profile.budgetMax}`}
            sub={
              profile.wantsPremiumLeather
                ? "Premium leather prioritised"
                : profile.wantsFastClose
                ? "Fast close prioritised"
                : "Balanced across dimensions"
            }
          />
        </div>
      </section>

      {/* ── Budget-mismatch banner ─────────────────────────────────────── */}
      {budgetMismatch && <BudgetBanner profile={profile} />}

      {/* ── Top 3 ─────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-brand-primary">
            Your top {results.length}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <ShareActions results={results} profile={profile} />
            <Link href="/quiz" className="btn-ghost">
              Retake quiz →
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          {results.map((match, i) => (
            <GloveCard key={match.glove.id} match={match} rank={i + 1} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Budget-mismatch banner ─────────────────────────────────────────────────

function BudgetBanner({ profile }: { profile: UserProfile }) {
  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-brand-accent/40 bg-brand-accent/10 p-5 md:p-6"
    >
      <p className="eyebrow text-brand-primary">Heads up on budget</p>
      <p className="mt-2 text-sm md:text-base leading-relaxed text-brand-text">
        Nothing in the catalog lands inside your ${profile.budgetMin}–$
        {profile.budgetMax} window right now, but here are the closest overall
        matches. Budget is weighed as a soft signal — these scored highest on
        fit, position, and the rest of your profile.
      </p>
    </section>
  );
}

// ─── Share actions (Copy + Email) ───────────────────────────────────────────

function ShareActions({
  results,
  profile,
}: {
  results: GloveMatchResult[];
  profile: UserProfile;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const origin =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const payload = { results, profile, origin };

  async function handleCopy() {
    const text = formatResultsAsText(payload);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Older browsers fallback.
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  }

  const mailto = buildMailtoUrl(payload);

  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <button
        type="button"
        onClick={handleCopy}
        className="btn-secondary text-sm"
        aria-label="Copy results to clipboard"
      >
        {status === "copied"
          ? "Copied ✓"
          : status === "error"
          ? "Copy failed"
          : "Copy results"}
      </button>
      <a
        href={mailto}
        className="btn-secondary text-sm"
        aria-label="Email results"
      >
        Email results
      </a>
    </div>
  );
}

function MetaCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-bg-deep bg-white/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-support">
        {label}
      </p>
      <p className="mt-2 font-display text-lg font-bold text-brand-primary">
        {value}
      </p>
      {sub && (
        <p className="mt-2 text-xs leading-relaxed text-brand-support">
          {sub}
        </p>
      )}
    </div>
  );
}
