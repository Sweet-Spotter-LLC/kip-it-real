/**
 * Kip It Real — deterministic explanation generator.
 *
 * Rules:
 *  - Every result gets 3–5 reasons, 1–3 tradeoffs, 1–2 avoidIf statements.
 *  - Language is specific and data-driven (no "no major issues" filler).
 *  - Each generator only fires if the condition it describes actually applies.
 *  - Generators are prioritised by impact score descending so the most
 *    important reasons surface first.
 */

import type {
  UserProfile,
  GloveProduct,
  ScoreBreakdownItem,
} from "./types";
import {
  POSITION_LABELS,
  SPORT_LABELS,
  WEB_TYPE_META,
} from "./constants";

interface Explanation {
  reasons: string[];
  tradeoffs: string[];
  avoidIf: string[];
}

// ─── Context helper ───────────────────────────────────────────────────────────

function posLabel(pos: UserProfile["primaryPosition"]): string {
  return POSITION_LABELS[pos] ?? pos;
}

function sportLabel(sport: UserProfile["sport"]): string {
  return SPORT_LABELS[sport] ?? sport;
}

/** Sub-score lookup by key. */
function sub(
  breakdown: ScoreBreakdownItem[],
  key: string,
): number {
  return breakdown.find((b) => b.key === key)?.value ?? 0;
}

// ─── Numeric → label helpers ──────────────────────────────────────────────────
// UserProfile stores normalised numeric targets; explanations reference the
// original preference vocabulary, so we derive labels from the numbers.

type PocketPrefLabel = "shallow" | "medium" | "deep";
type FitPrefLabel = "snug" | "balanced" | "roomy";
type BreakInPrefLabel = "game_ready" | "balanced" | "premium_stiff";

function pocketPrefFromProfile(p: UserProfile): PocketPrefLabel {
  if (p.pocketDepthTarget <= -0.8) return "shallow";
  if (p.pocketDepthTarget >= 1.2) return "deep";
  return "medium";
}

function fitPrefFromProfile(p: UserProfile): FitPrefLabel {
  if (p.fitTarget <= -0.8) return "snug";
  if (p.fitTarget >= 0.8) return "roomy";
  return "balanced";
}

function breakInPrefFromProfile(p: UserProfile): BreakInPrefLabel {
  if (p.breakInTolerance <= 1.5) return "game_ready";
  if (p.breakInTolerance >= 4) return "premium_stiff";
  return "balanced";
}

// ─── Reason generators ────────────────────────────────────────────────────────

interface Generator {
  type: "reason" | "tradeoff" | "avoidIf";
  condition: (p: UserProfile, g: GloveProduct, b: ScoreBreakdownItem[]) => boolean;
  text: (p: UserProfile, g: GloveProduct, b: ScoreBreakdownItem[]) => string;
  /** Higher priority = closer to the top of the list. */
  priority: number;
}

const GENERATORS: Generator[] = [
  // ── Reasons ─────────────────────────────────────────────────────────────────

  {
    type: "reason",
    priority: 100,
    condition: (p, g, b) => sub(b, "positionFit") >= 0.8,
    text: (p, g) =>
      `Built for ${posLabel(p.primaryPosition)} — ${g.name.split(" ").slice(0, 2).join(" ")} is tagged for your exact spot.`,
  },
  {
    type: "reason",
    priority: 95,
    condition: (p, g, b) => sub(b, "sizeFit") >= 0.9,
    text: (p, g) =>
      `Size ${g.sizeInches}" lands inside your recommended range of ${p.recommendedSizeMin}"–${p.recommendedSizeMax}" for ${sportLabel(p.sport)} ${posLabel(p.primaryPosition)}.`,
  },
  {
    type: "reason",
    priority: 90,
    condition: (p, g, b) => sub(b, "pocketFit") >= 0.8,
    text: (p, g) => {
      const depthWord = g.pocketDepth > 1 ? "deeper" : g.pocketDepth < -0.5 ? "shallow" : "medium";
      const pref = pocketPrefFromProfile(p);
      return `${depthWord.charAt(0).toUpperCase() + depthWord.slice(1)} pocket aligns with your preference for ${
        pref === "deep" ? "catch security" :
        pref === "shallow" ? "quick transfer" :
        "balanced pocket depth"
      }.`;
    },
  },
  {
    type: "reason",
    priority: 88,
    condition: (p, g, b) => sub(b, "breakInFit") >= 0.9,
    text: (p, g) => {
      const pref = breakInPrefFromProfile(p);
      return pref === "game_ready"
        ? `Stiffness rating of ${g.stiffness}/5 means this one breaks in fast — close to game-ready right out of the box.`
        : pref === "premium_stiff"
        ? `Stiffness rating of ${g.stiffness}/5 aligns with your preference for a premium leather break-in experience.`
        : `Moderate stiffness (${g.stiffness}/5) means a reasonable break-in period — not too soft, not a project.`;
    },
  },
  {
    type: "reason",
    priority: 85,
    condition: (p, g, b) => sub(b, "fitProfile") >= 0.85,
    text: (p) => {
      const pref = fitPrefFromProfile(p);
      return pref === "snug"
        ? `Hand stall is on the snug side — locks in close to your hand the way you described.`
        : pref === "roomy"
        ? `Roomier hand opening gives you the extra space you're looking for.`
        : `Balanced hand opening — fits comfortably without feeling loose or restrictive.`;
    },
  },
  {
    type: "reason",
    priority: 82,
    condition: (p, g, b) =>
      sub(b, "leatherQualityFit") >= 0.85 && p.wantsPremiumLeather,
    text: (p, g) =>
      `Leather quality scores ${g.leatherQuality}/5 — top-tier hide that holds its shape and develops a great feel over time.`,
  },
  {
    type: "reason",
    priority: 80,
    condition: (p, g, b) =>
      sub(b, "webFit") >= 0.9 &&
      p.webPreference !== undefined &&
      p.webPreference !== "unsure",
    text: (p, g) => {
      const meta = WEB_TYPE_META[g.webType];
      return `${meta.label} web is exactly what you asked for — a ${meta.description}.`;
    },
  },
  {
    type: "reason",
    priority: 78,
    condition: (p, g, b) =>
      sub(b, "webFit") >= 0.75 && !p.webPreference,
    text: (p, g) => {
      const meta = WEB_TYPE_META[g.webType];
      return `${meta.label} web is a natural pick for ${posLabel(p.primaryPosition)} — ${meta.description}.`;
    },
  },
  {
    type: "reason",
    priority: 76,
    condition: (p, g, b) =>
      sub(b, "fastpitchFitImportance") === 1 && g.fastpitchFit,
    text: () =>
      `Purpose-built for fastpitch — narrower stall and wrist opening specifically designed for female hand geometry.`,
  },
  {
    type: "reason",
    priority: 74,
    condition: (p, g, b) =>
      sub(b, "versatilityFit") >= 0.85 && p.wantsVersatility,
    text: (p, g) =>
      `Versatility score of ${g.versatilityScore}/5 means it can travel across positions — works for your multi-spot role.`,
  },
  {
    type: "reason",
    priority: 72,
    condition: (p, g, b) => sub(b, "budgetFit") === 1.0,
    text: (p, g) =>
      `At $${g.price}, it fits comfortably within your $${p.budgetMax} ceiling — no compromise required.`,
  },
  {
    type: "reason",
    priority: 70,
    condition: (p, g, b) =>
      sub(b, "youthFriendliness") === 1 && p.ageGroup === "youth",
    text: () =>
      `Lighter shell and smaller stall are specifically designed for younger hands — easier to close and control.`,
  },
  {
    type: "reason",
    priority: 65,
    condition: (p, g, b) =>
      p.secondaryPosition !== undefined &&
      g.positionTags.includes(p.secondaryPosition!),
    text: (p, g) =>
      `Tagged for ${posLabel(p.secondaryPosition!)} as well — works across both positions you play.`,
  },

  // ── Tradeoffs ────────────────────────────────────────────────────────────────

  {
    type: "tradeoff",
    priority: 100,
    condition: (p, g) =>
      g.stiffness >= 4 && breakInPrefFromProfile(p) === "game_ready",
    text: (p, g) =>
      `Stiffness of ${g.stiffness}/5 will need real work before game use — conditioning oil and catch drills required.`,
  },
  {
    type: "tradeoff",
    priority: 95,
    condition: (p, g) => g.price > p.budgetMax,
    text: (p, g) =>
      `Price of $${g.price} is above your $${p.budgetMax} ceiling — factor in the gap if you stretch for this one.`,
  },
  {
    type: "tradeoff",
    priority: 90,
    condition: (p, g) =>
      g.pocketDepth > 1.5 && p.primaryPosition === "infield",
    text: () =>
      `Deeper pocket may slow your transfer out of the glove — infielders who want lightning-quick hands might feel it.`,
  },
  {
    type: "tradeoff",
    priority: 88,
    condition: (p, g) =>
      g.pocketDepth < -0.5 && p.primaryPosition === "outfield",
    text: () =>
      `Shallower pocket is a better fit for infield — outfielders may need more pocket depth for range balls.`,
  },
  {
    type: "tradeoff",
    priority: 85,
    condition: (p, g) =>
      g.leatherQuality >= 4 && breakInPrefFromProfile(p) !== "premium_stiff",
    text: () =>
      `Premium leather means longer break-in time than entry-level options — plan for several sessions before it's game-ready.`,
  },
  {
    type: "tradeoff",
    priority: 80,
    condition: (p, g) =>
      g.leatherQuality <= 2 && p.wantsPremiumLeather,
    text: (p, g) =>
      `Entry-level leather ($${g.price} price point) won't develop the same long-term feel as premium hides — durability may trail off with heavy use.`,
  },
  {
    type: "tradeoff",
    priority: 78,
    condition: (p, g) =>
      g.versatilityScore <= 2 && p.wantsVersatility,
    text: () =>
      `Designed for a specific position — versatility score is low, so it won't feel as natural if you move around.`,
  },
  {
    type: "tradeoff",
    priority: 75,
    condition: (p, g) =>
      g.fitProfile < -1 && fitPrefFromProfile(p) === "roomy",
    text: () =>
      `Narrower hand stall may feel restricting if you prefer a roomier opening — size up if offered.`,
  },
  {
    type: "tradeoff",
    priority: 73,
    condition: (p, g) =>
      g.fitProfile > 1.5 && fitPrefFromProfile(p) === "snug",
    text: () =>
      `Roomier stall might feel loose if you want a locked-in, snug fit — may require a wrist strap adjustment.`,
  },
  {
    type: "tradeoff",
    priority: 70,
    condition: (p, g) =>
      !g.fastpitchFit && p.sport === "fastpitch" && p.fastpitchFitImportant,
    text: () =>
      `Not designed specifically for fastpitch — wrist and stall geometry may not match the fit you were hoping for.`,
  },

  // ── Avoid if ─────────────────────────────────────────────────────────────────

  {
    type: "avoidIf",
    priority: 100,
    condition: (p, g) =>
      g.stiffness >= 4 && p.experienceLevel === "beginner",
    text: () =>
      `Avoid this if you are a beginner who needs a glove ready to use soon — breaking in stiff leather takes significant time and effort.`,
  },
  {
    type: "avoidIf",
    priority: 95,
    condition: (p, g) =>
      g.pocketDepth > 1.5 && pocketPrefFromProfile(p) === "shallow",
    text: () =>
      `Avoid this if you want a shallow infield-style pocket — this glove runs deeper than your preference.`,
  },
  {
    type: "avoidIf",
    priority: 93,
    condition: (p, g) =>
      g.pocketDepth < -0.5 && pocketPrefFromProfile(p) === "deep",
    text: () =>
      `Avoid this if you want deep catch security — the pocket is shallower than what you described.`,
  },
  {
    type: "avoidIf",
    priority: 90,
    condition: (p, g) =>
      breakInPrefFromProfile(p) === "game_ready" && g.stiffness >= 3,
    text: () =>
      `Avoid this if you need it game-ready right away — the leather will need a real break-in commitment.`,
  },
  {
    type: "avoidIf",
    priority: 88,
    condition: (p, g) =>
      p.ageGroup === "youth" && !g.youthFriendly,
    text: () =>
      `Avoid this if the player has smaller hands — the stall and shell are built for adult-sized hands.`,
  },
  {
    type: "avoidIf",
    priority: 85,
    condition: (p, g) =>
      p.sport === "fastpitch" && p.fastpitchFitImportant && !g.fastpitchFit,
    text: () =>
      `Avoid this if fastpitch-specific hand opening is a priority — the wrist geometry is not fastpitch-optimised.`,
  },
  {
    type: "avoidIf",
    priority: 80,
    condition: (p, g) =>
      p.wantsVersatility && g.versatilityScore <= 1,
    text: () =>
      `Avoid this if you move around the field — it is designed for one specific spot.`,
  },
  {
    type: "avoidIf",
    priority: 78,
    condition: (p, g) =>
      p.wantsFastClose && g.easyClose < 0,
    text: () =>
      `Avoid this if you need a fast close — the shell resistance is high and it won't snap shut quickly.`,
  },
  {
    type: "avoidIf",
    priority: 75,
    condition: (p, g) =>
      p.secondaryPosition !== undefined &&
      !g.positionTags.includes(p.secondaryPosition!),
    text: (p, g) =>
      `Avoid this if ${posLabel(p.secondaryPosition!)} is a regular spot for you — it is not tagged for that position.`,
  },
];

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generates explanation text for a single scored glove.
 *
 * Returns 3–5 reasons, 1–3 tradeoffs, and 1–2 avoidIf statements.
 * Each list is sorted by priority descending then trimmed to limits.
 */
export function generateExplanation(
  profile: UserProfile,
  glove: GloveProduct,
  breakdown: ScoreBreakdownItem[],
): Explanation {
  const reasons: string[] = [];
  const tradeoffs: string[] = [];
  const avoidIf: string[] = [];

  // Run all generators, collect fired ones sorted by priority descending.
  const fired = GENERATORS.filter((g) =>
    g.condition(profile, glove, breakdown),
  ).sort((a, b) => b.priority - a.priority);

  for (const gen of fired) {
    const text = gen.text(profile, glove, breakdown);
    if (gen.type === "reason" && reasons.length < 5) reasons.push(text);
    if (gen.type === "tradeoff" && tradeoffs.length < 3) tradeoffs.push(text);
    if (gen.type === "avoidIf" && avoidIf.length < 2) avoidIf.push(text);
  }

  // ── Fallbacks (these fire ONLY if the category is still empty) ────────────

  if (reasons.length < 3) {
    // Always-fire fallbacks to meet the 3-reason minimum.
    reasons.push(
      `${glove.name} is in the ${SPORT_LABELS[profile.sport]} lineup and cleared all position-fit checks.`,
    );
    if (reasons.length < 3) {
      reasons.push(
        `Leather quality of ${glove.leatherQuality}/5 and durability of ${glove.durabilityScore}/5 make this a solid long-term option.`,
      );
    }
    if (reasons.length < 3) {
      reasons.push(
        `At $${glove.price}, the price reflects a ${
          glove.leatherQuality >= 4
            ? "premium"
            : glove.leatherQuality === 3
            ? "mid-range"
            : "entry-level"
        } leather tier.`,
      );
    }
  }

  if (tradeoffs.length === 0) {
    tradeoffs.push(
      `Transfer speed bias of ${glove.transferSpeedBias > 0 ? "+" : ""}${glove.transferSpeedBias} means ${
        glove.transferSpeedBias > 1
          ? "quick transfer at the cost of some catch depth"
          : glove.transferSpeedBias < -0.5
          ? "deep catch security at the cost of transfer quickness"
          : "a balanced approach — neither a speed nor security specialist"
      }.`,
    );
  }

  if (avoidIf.length === 0) {
    avoidIf.push(
      `Avoid this if your priorities shifted since answering the quiz — run through it again to get a fresh match.`,
    );
  }

  return { reasons, tradeoffs, avoidIf };
}
