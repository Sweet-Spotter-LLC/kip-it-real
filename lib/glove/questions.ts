/**
 * Config-driven quiz questions for Kip It Real.
 *
 * Each question uses `showIf` so the runtime engine branches deterministically
 * on sport + position rather than baking branching into page components.
 *
 * Branching rules baked in here:
 *  - Baseball, Fastpitch, and Slowpitch do not ask identical question sets.
 *  - Catcher / First Base short-circuit web + pocket questions (mitt-specific).
 *  - Fastpitch asks `fastpitchFitImportant` (hand-opening emphasis).
 *  - Slowpitch asks `wantsVersatility` (bigger pocket / utility bias).
 */

import type { QuizQuestion } from "./types";

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ── Step 1: Sport ─────────────────────────────────────────────────────────
  {
    id: "sport",
    step: 1,
    label: "What sport are you shopping for?",
    description: "We tune fit, size, and pocket differently for each.",
    type: "single_select",
    options: [
      { label: "Baseball", value: "baseball" },
      { label: "Fastpitch softball", value: "fastpitch" },
      { label: "Slowpitch softball", value: "slowpitch" },
    ],
  },

  // ── Step 2: Age group ─────────────────────────────────────────────────────
  {
    id: "ageGroup",
    step: 2,
    label: "Age group",
    description: "This sets your starting size range.",
    type: "single_select",
    options: [
      { label: "Youth (12 and under)", value: "youth" },
      { label: "Teen (13 to 17)", value: "teen" },
      { label: "Adult (18+)", value: "adult" },
    ],
  },

  // ── Step 3: Throw hand ────────────────────────────────────────────────────
  {
    id: "throwHand",
    step: 3,
    label: "Which hand do you throw with?",
    description: "The glove goes on your non-throwing hand.",
    type: "single_select",
    options: [
      { label: "Right-handed thrower", value: "RHT" },
      { label: "Left-handed thrower", value: "LHT" },
    ],
  },

  // ── Step 4: Primary position ──────────────────────────────────────────────
  {
    id: "primaryPosition",
    step: 4,
    label: "Primary position",
    description: "Pick the spot you play most.",
    type: "single_select",
    options: [
      { label: "Infield", value: "infield" },
      { label: "Outfield", value: "outfield" },
      { label: "Pitcher", value: "pitcher" },
      { label: "Catcher", value: "catcher" },
      { label: "First base", value: "first_base" },
      { label: "Utility / multiple spots", value: "utility" },
    ],
  },

  // ── Step 5: Secondary position (only if utility-leaning) ─────────────────
  {
    id: "secondaryPosition",
    step: 5,
    label: "Do you cover a second position?",
    description: "Optional — helps us find a more versatile pattern.",
    type: "single_select",
    options: [
      { label: "No second position", value: "none" },
      { label: "Infield", value: "infield" },
      { label: "Outfield", value: "outfield" },
      { label: "Pitcher", value: "pitcher" },
      { label: "Utility / flex spots", value: "utility" },
    ],
    // Catchers and 1B use specialized mitts — skip dual-role logic.
    showIf: (a) =>
      a.primaryPosition !== "catcher" && a.primaryPosition !== "first_base",
  },

  // ── Step 6: Experience level ─────────────────────────────────────────────
  {
    id: "experienceLevel",
    step: 6,
    label: "Experience level",
    type: "single_select",
    options: [
      { label: "Beginner", value: "beginner" },
      { label: "Intermediate", value: "intermediate" },
      { label: "Advanced", value: "advanced" },
    ],
  },

  // ── Step 7: Play frequency ───────────────────────────────────────────────
  {
    id: "playFrequency",
    step: 7,
    label: "How often do you play?",
    type: "single_select",
    options: [
      { label: "Casually / pickup games", value: "casual" },
      { label: "Weekly practices and games", value: "weekly" },
      { label: "Competitive / travel / tournament", value: "competitive" },
    ],
  },

  // ── Step 8: Fit preference ───────────────────────────────────────────────
  {
    id: "fitPreference",
    step: 8,
    label: "Preferred hand fit",
    description: "Do you like the glove tight to your hand or a bit roomier?",
    type: "single_select",
    options: [
      { label: "Snug / locked in", value: "snug" },
      { label: "Balanced", value: "balanced" },
      { label: "Roomy / larger stall", value: "roomy" },
    ],
  },

  // ── Step 9: Pocket preference (skip mitts) ───────────────────────────────
  {
    id: "pocketPreference",
    step: 9,
    label: "Pocket depth preference",
    description: "Shallow = faster transfer. Deep = more catch security.",
    type: "single_select",
    options: [
      { label: "Shallow (quick transfer)", value: "shallow" },
      { label: "Medium", value: "medium" },
      { label: "Deep (catch security)", value: "deep" },
      { label: "Not sure — recommend for me", value: "unsure" },
    ],
    showIf: (a) =>
      a.primaryPosition !== "catcher" && a.primaryPosition !== "first_base",
  },

  // ── Step 10: Break-in preference ─────────────────────────────────────────
  {
    id: "breakInPreference",
    step: 10,
    label: "Break-in tolerance",
    description:
      "Do you want it ready for Saturday, or are you willing to break in premium leather?",
    type: "single_select",
    options: [
      { label: "Game-ready out of the box", value: "game_ready" },
      { label: "Balanced — some break-in is fine", value: "balanced" },
      { label: "I want premium stiff leather", value: "premium_stiff" },
    ],
  },

  // ── Step 11: Web preference (skip mitts) ─────────────────────────────────
  {
    id: "webPreference",
    step: 11,
    label: "Web style preference",
    description: "If you have a favorite. Otherwise we'll match by position.",
    type: "single_select",
    options: [
      { label: "I-Web", value: "i_web" },
      { label: "H-Web", value: "h_web" },
      { label: "Basket", value: "basket" },
      { label: "Modified trap", value: "modified_trap" },
      { label: "Trap", value: "trap" },
      { label: "Single post", value: "single_post" },
      { label: "Two-piece closed", value: "two_piece_closed" },
      { label: "Closed", value: "closed" },
      { label: "Not sure — recommend for me", value: "unsure" },
    ],
    showIf: (a) =>
      a.primaryPosition !== "catcher" && a.primaryPosition !== "first_base",
  },

  // ── Step 12: Fast close (skip mitts) ─────────────────────────────────────
  {
    id: "wantsFastClose",
    step: 12,
    label: "Do you want a glove that closes fast?",
    description: "Great for infielders and quick-transfer players.",
    type: "boolean",
    showIf: (a) =>
      a.primaryPosition !== "catcher" && a.primaryPosition !== "first_base",
  },

  // ── Step 13: Premium leather ─────────────────────────────────────────────
  {
    id: "wantsPremiumLeather",
    step: 13,
    label: "Prioritize premium leather?",
    description: "Longer life, better shape retention — but more break-in.",
    type: "boolean",
  },

  // ── Step 14: Versatility (Slowpitch + Utility only) ──────────────────────
  {
    id: "wantsVersatility",
    step: 14,
    label: "Should it play well across multiple positions?",
    type: "boolean",
    showIf: (a) =>
      a.sport === "slowpitch" || a.primaryPosition === "utility",
  },

  // ── Step 15: Fastpitch fit importance (Fastpitch only) ───────────────────
  {
    id: "fastpitchFitImportant",
    step: 15,
    label: "Is a fastpitch-specific hand opening important to you?",
    description:
      "Fastpitch-specific gloves have a tighter wrist + narrower stall.",
    type: "boolean",
    showIf: (a) => a.sport === "fastpitch",
  },

  // ── Step 16: Budget range ────────────────────────────────────────────────
  // Kept second-to-last so the user has made their fit decisions before
  // being asked to constrain on price.
  {
    id: "budgetMax",
    step: 16,
    label: "What is your budget ceiling?",
    description: "We'll respect this as a soft cap and flag nearby options.",
    type: "range",
    options: [
      { label: "Under $100", value: 100 },
      { label: "Up to $200", value: 200 },
      { label: "Up to $350", value: 350 },
      { label: "Up to $500", value: 500 },
      { label: "No budget limit", value: 1000 },
    ],
  },

  // ── Step 17: Preferred brands ────────────────────────────────────────────
  // Intentionally last — brand is the softest signal and we never want to
  // filter a great match out because of brand preference.
  {
    id: "preferredBrands",
    step: 17,
    label: "Any brands you lean toward?",
    description: "Optional. Skip if you are open.",
    type: "brand_picker",
    options: [
      { label: "Rawlings", value: "Rawlings" },
      { label: "Wilson", value: "Wilson" },
      { label: "Mizuno", value: "Mizuno" },
      { label: "Marucci", value: "Marucci" },
      { label: "Nokona", value: "Nokona" },
      { label: "Easton", value: "Easton" },
      { label: "Louisville Slugger", value: "Louisville Slugger" },
      { label: "44 Pro", value: "44 Pro" },
    ],
  },
];

/**
 * Returns the ordered list of questions that should be shown
 * given the current partial answers. Pure function — no side effects.
 */
export function getVisibleQuestions(
  answers: Partial<import("./types").QuizAnswers>,
): QuizQuestion[] {
  return QUIZ_QUESTIONS.filter((q) => (q.showIf ? q.showIf(answers) : true));
}

/** Total steps the user will see — useful for the progress bar. */
export function totalVisibleSteps(
  answers: Partial<import("./types").QuizAnswers>,
): number {
  return getVisibleQuestions(answers).length;
}
