/**
 * Kip It Real — deterministic explanation generator.
 *
 * Rules:
 *  - Every result gets 3–5 reasons and 1–4 tradeoffs.
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
import {
  leatherLabel,
  stiffnessLabel,
  durabilityLabel,
  versatilityLabel,
  transferSpeedLabel,
} from "./qualitative";

interface Explanation {
  reasons: string[];
  tradeoffs: string[];
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

// ─── Budget-gap helpers ───────────────────────────────────────────────────────
// The tradeoff copy adapts based on how far over budget the glove is,
// and how often the player uses it. This lets us say something concrete
// ("end-of-season sale closes that gap") instead of a generic "it costs more."

/** Price delta above the user's ceiling (0 if inside or below). */
function overBudgetAmount(p: UserProfile, g: GloveProduct): number {
  return Math.max(0, g.price - p.budgetMax);
}

/** Delta as a fraction of the ceiling — e.g. 0.25 = 25% over. */
function overBudgetRatio(p: UserProfile, g: GloveProduct): number {
  if (p.budgetMax <= 0) return 0;
  return overBudgetAmount(p, g) / p.budgetMax;
}

type BudgetGap = "inside" | "small" | "medium" | "large";
function budgetGap(p: UserProfile, g: GloveProduct): BudgetGap {
  const ratio = overBudgetRatio(p, g);
  if (ratio <= 0) return "inside";
  if (ratio <= 0.2) return "small";
  if (ratio <= 0.5) return "medium";
  return "large";
}

/** Nice dollar-delta string, e.g. "$45". */
function dollarGap(p: UserProfile, g: GloveProduct): string {
  return `$${Math.round(overBudgetAmount(p, g))}`;
}

// ─── Reason generators ────────────────────────────────────────────────────────

interface Generator {
  type: "reason" | "tradeoff";
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
        ? `${stiffnessLabel(g.stiffness)} leather means this one breaks in fast — close to game-ready right out of the box.`
        : pref === "premium_stiff"
        ? `${stiffnessLabel(g.stiffness)} leather aligns with your preference for a proper premium break-in experience.`
        : `${stiffnessLabel(g.stiffness)} leather means a reasonable break-in period — not too soft, not a project.`;
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
      `${leatherLabel(g.leatherQuality)} leather — top-tier hide that holds its shape and develops a great feel over time.`,
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
      `${versatilityLabel(g.versatilityScore)} — designed to travel across positions and work in your multi-spot role.`,
  },
  {
    type: "reason",
    priority: 68,
    condition: (p, g, b) =>
      sub(b, "positionFit") >= 0.6 && sub(b, "positionFit") < 0.8,
    text: (p, g) =>
      `Tagged as a utility glove — versatile enough to cover ${posLabel(p.primaryPosition)} and the other spots you rotate through.`,
  },
  {
    type: "reason",
    priority: 72,
    // Suppress for premium-leather users — their budgetMax is a $10 000 sentinel,
    // so this would fire for every real glove and produce nonsense ceiling copy.
    condition: (p, g, b) => sub(b, "budgetFit") === 1.0 && !p.wantsPremiumLeather,
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
      `${stiffnessLabel(g.stiffness)} leather will need real work before game use — conditioning oil and catch drills required.`,
  },
  // Price gap — three tiers, only one fires at a time thanks to budgetGap().

  // Small stretch (≤ 20% over): nudge toward sales / last year's model.
  {
    type: "tradeoff",
    priority: 95,
    condition: (p, g) => budgetGap(p, g) === "small",
    text: (p, g) =>
      `Only ${dollarGap(p, g)} over your $${p.budgetMax} ceiling — last year's colorway or an end-of-season sale usually closes that gap without dropping a tier.`,
  },

  // Medium stretch (20–50% over): reframe as cost-per-season or suggest the
  // secondhand market where enthusiasts resell lightly-used premium leather.
  {
    type: "tradeoff",
    priority: 94,
    condition: (p, g) => budgetGap(p, g) === "medium",
    text: (p, g) => {
      const freq = p.playFrequency;
      const seasonFraming =
        freq === "competitive"
          ? "if you're on the field year-round, the per-season cost is modest"
          : freq === "weekly"
          ? "if you play weekly, amortised across a season the stretch is smaller than it looks"
          : "if this will mostly see weekend use, the stretch is harder to justify";
      return `${dollarGap(p, g)} above your $${p.budgetMax} ceiling — ${seasonFraming}. Otherwise, lightly-used copies on SidelineSwap or Facebook glove groups often sell a full tier below retail.`;
    },
  },

  // Large stretch (> 50% over): recommend a step down or the pre-owned market.
  {
    type: "tradeoff",
    priority: 93,
    condition: (p, g) => budgetGap(p, g) === "large",
    text: (p, g) =>
      `Price of $${g.price} is well past your $${p.budgetMax} ceiling (${dollarGap(p, g)} over). Consider the brand's mid-grade line, or shop the pre-owned market — a used premium glove often beats a new entry-level one on feel and longevity.`,
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
    priority: 74,
    condition: (p, g) =>
      g.leatherQuality >= 5 && p.playFrequency === "casual",
    text: () =>
      `Elite leather rewards regular use — for casual play, the break-in investment and price premium may not fully pay off versus a solid mid-grade glove.`,
  },
  {
    type: "tradeoff",
    priority: 71,
    condition: (p, g) =>
      g.stiffness >= 4 &&
      (p.playFrequency === "casual" || p.experienceLevel === "beginner"),
    text: (p, g) =>
      `${stiffnessLabel(g.stiffness)} leather needs consistent work to open up — casual players or beginners may prefer something softer that's closer to game-ready.`,
  },
  {
    type: "tradeoff",
    priority: 70,
    condition: (p, g) =>
      !g.fastpitchFit && p.sport === "fastpitch" && p.fastpitchFitImportant,
    text: () =>
      `Not designed specifically for fastpitch — wrist and stall geometry may not match the fit you were hoping for.`,
  },
];

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generates explanation text for a single scored glove.
 *
 * Returns 3–5 reasons and 1–4 tradeoffs.
 * Each list is sorted by priority descending then trimmed to limits.
 */
export function generateExplanation(
  profile: UserProfile,
  glove: GloveProduct,
  breakdown: ScoreBreakdownItem[],
): Explanation {
  const reasons: string[] = [];
  const tradeoffs: string[] = [];

  // Run all generators, collect fired ones sorted by priority descending.
  const fired = GENERATORS.filter((g) =>
    g.condition(profile, glove, breakdown),
  ).sort((a, b) => b.priority - a.priority);

  for (const gen of fired) {
    const text = gen.text(profile, glove, breakdown);
    if (gen.type === "reason" && reasons.length < 5) reasons.push(text);
    if (gen.type === "tradeoff" && tradeoffs.length < 4) tradeoffs.push(text);
  }

  // ── Fallbacks (these fire ONLY if the category is still empty) ────────────

  if (reasons.length < 3) {
    // Always-fire fallbacks to meet the 3-reason minimum.
    reasons.push(
      `${glove.name} is in the ${SPORT_LABELS[profile.sport]} lineup and cleared all position-fit checks.`,
    );
    if (reasons.length < 3) {
      reasons.push(
        `${leatherLabel(glove.leatherQuality)} leather and ${durabilityLabel(glove.durabilityScore).toLowerCase()} durability make this a solid long-term option.`,
      );
    }
    if (reasons.length < 3) {
      if (profile.wantsPremiumLeather) {
        reasons.push(
          `${leatherLabel(glove.leatherQuality)} leather puts this in the ${
            glove.leatherQuality >= 5
              ? "top-tier full-grain"
              : glove.leatherQuality >= 4
              ? "premium leather"
              : "solid mid-range leather"
          } category — built to mold to your hand and improve with use.`,
        );
      } else {
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
  }

  if (tradeoffs.length === 0) {
    const tsLabel = transferSpeedLabel(glove.transferSpeedBias);
    const tsMeaning =
      glove.transferSpeedBias > 1
        ? "built for quick release at the cost of some catch depth"
        : glove.transferSpeedBias < -0.5
        ? "prioritizes deep catch security over transfer speed"
        : "balanced approach — neither a speed nor a security specialist";
    tradeoffs.push(`${tsLabel}: ${tsMeaning}.`);
  }

  return { reasons, tradeoffs };
}
