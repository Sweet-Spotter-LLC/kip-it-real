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
 *  - Fast-close is only relevant for Infield / Utility (skipped elsewhere).
 *  - Web options are filtered to those compatible with the player's
 *    primary (and secondary) position, with explicit "[Position Only]"
 *    labels when a web leans toward one of multiple positions played.
 *  - The "Kip it Real?" premium question is the fork in the road: Yes
 *    skips the budget question entirely and enables the premium-leather
 *    scoring path downstream.
 */

import type {
  PositionType,
  QuizAnswers,
  QuizQuestion,
  QuizQuestionOption,
  WebPreference,
} from "./types";
import {
  POSITION_LABELS,
  WEB_TYPE_META,
  WEBS_BY_POSITION,
} from "./constants";

// ─── Web option builder ───────────────────────────────────────────────────────

/**
 * Build the list of web options to show, filtered and labeled based on
 * the user's primary + secondary positions.
 *
 *   - Only webs compatible with at least one of the user's positions are
 *     shown (via WEBS_BY_POSITION).
 *   - When the user plays two positions and a web is compatible with only
 *     one, its label gets an explicit constraint tag, e.g.
 *     "I-Web [Infield Only]" or "Trap [Outfield Only]". This prevents a
 *     utility player from accidentally picking a web that only works for
 *     half the positions they actually cover.
 *   - The "Not sure — recommend for me" escape hatch is always included.
 */
function buildWebOptions(
  answers: Partial<QuizAnswers>,
): QuizQuestionOption[] | undefined {
  const primary = answers.primaryPosition;
  if (!primary) return undefined;

  const secondaryRaw = answers.secondaryPosition;
  const secondary: PositionType | undefined =
    secondaryRaw && secondaryRaw !== "none" ? secondaryRaw : undefined;

  const primaryWebs = new Set<WebPreference>(WEBS_BY_POSITION[primary] ?? []);
  const secondaryWebs = new Set<WebPreference>(
    secondary ? WEBS_BY_POSITION[secondary] ?? [] : [],
  );
  const union = new Set<WebPreference>([...primaryWebs, ...secondaryWebs]);

  const opts: QuizQuestionOption[] = [];
  for (const web of union) {
    const meta = WEB_TYPE_META[web];
    if (!meta) continue;

    let label = meta.label;
    if (secondary) {
      const inPrimary = primaryWebs.has(web);
      const inSecondary = secondaryWebs.has(web);
      if (inPrimary && !inSecondary) {
        label = `${meta.label} [${POSITION_LABELS[primary]} Only]`;
      } else if (!inPrimary && inSecondary) {
        label = `${meta.label} [${POSITION_LABELS[secondary]} Only]`;
      }
    }
    opts.push({ label, value: web, hint: meta.description });
  }

  // Escape hatch — always available.
  opts.push({
    label: "Not sure — recommend for me",
    value: "unsure",
  });

  return opts;
}

// ─── Question list ────────────────────────────────────────────────────────────

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

  // ── Step 10: Break-in effort (rephrased) ─────────────────────────────────
  // Focuses on the player's commitment, not the leather. Leather quality is
  // owned by the "Kip it Real?" fork further down.
  {
    id: "breakInPreference",
    step: 10,
    label: "How much work are you willing to put into the break-in process?",
    description:
      "Gloves range from ready-to-use to multi-week conditioning projects.",
    type: "single_select",
    options: [
      {
        label: "None — I want it game-ready",
        value: "game_ready",
        hint: "Ready for Saturday out of the box.",
      },
      {
        label: "Some — I'll do a standard break-in",
        value: "balanced",
        hint: "A week or two of catch and conditioning.",
      },
      {
        label: "A lot — I'll put in the full work",
        value: "premium_stiff",
        hint: "Happy to spend weeks shaping a premium glove.",
      },
    ],
  },

  // ── Step 11: Web preference (skip mitts, position-filtered) ──────────────
  {
    id: "webPreference",
    step: 11,
    label: "Web style preference",
    description:
      "Filtered to webs that fit the position(s) you play. Pick whichever feels right.",
    type: "single_select",
    // Static options are the full list — used as a fallback only; the
    // runtime pulls options from getOptions() so the set is position-aware.
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
    getOptions: buildWebOptions,
    showIf: (a) =>
      a.primaryPosition !== "catcher" && a.primaryPosition !== "first_base",
  },

  // ── Step 12: Fast close (Infield / Utility only) ─────────────────────────
  // The original showIf allowed every non-mitt primary position. We narrow
  // it here so outfield, pitcher, etc. don't see a question that doesn't
  // apply to their craft.
  {
    id: "wantsFastClose",
    step: 12,
    label: "Do you want a glove that closes fast?",
    description: "Great for infielders and quick-transfer players.",
    type: "boolean",
    showIf: (a) =>
      a.primaryPosition === "infield" || a.primaryPosition === "utility",
  },

  // ── Step 13: Preferred brands (moved up from final step) ─────────────────
  // Brand is still a soft signal, but asking earlier lets the Kip It Real
  // fork close out the flow without a trailing brand picker.
  {
    id: "preferredBrands",
    step: 13,
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

  // ── Step 16: Kip it Real? (premium-leather fork, second-to-last) ─────────
  {
    id: "wantsPremiumLeather",
    step: 16,
    label: "Kip it Real?",
    description:
      "Prioritize premium leather for maximum longevity and feel.",
    warning:
      "Note: Choosing 'Yes' prioritizes elite leather (Japanese Kip / Premium Steerhide). This will automatically optimize your results for professional-grade gear, which carries a higher price point.",
    type: "boolean",
  },

  // ── Step 17: Budget range (skipped when Kip it Real = Yes) ───────────────
  // When the user takes the premium path we set budgetSkipped = true in the
  // quiz container and jump straight to results; this showIf is the
  // deterministic gate that enforces it.
  {
    id: "budgetMax",
    step: 17,
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
    showIf: (a) => a.wantsPremiumLeather !== true,
  },
];

/**
 * Returns the ordered list of questions that should be shown
 * given the current partial answers. Pure function — no side effects.
 */
export function getVisibleQuestions(
  answers: Partial<QuizAnswers>,
): QuizQuestion[] {
  return QUIZ_QUESTIONS.filter((q) => (q.showIf ? q.showIf(answers) : true));
}

/**
 * Resolves the options for a question given the current answers —
 * honouring dynamic `getOptions` resolvers (e.g. position-filtered webs)
 * before falling back to the static `options` array.
 */
export function resolveQuestionOptions(
  question: QuizQuestion,
  answers: Partial<QuizAnswers>,
): QuizQuestionOption[] | undefined {
  if (question.getOptions) {
    const dynamic = question.getOptions(answers);
    if (dynamic && dynamic.length > 0) return dynamic;
  }
  return question.options;
}

/** Total steps the user will see — useful for the progress bar. */
export function totalVisibleSteps(
  answers: Partial<QuizAnswers>,
): number {
  return getVisibleQuestions(answers).length;
}
