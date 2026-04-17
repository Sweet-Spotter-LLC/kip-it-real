/**
 * Sport- and position-aware size guidance for Kip It Real.
 *
 * Returns a recommended size range in inches plus a short human-readable
 * reason string that can be surfaced on the results page.
 *
 * Ranges here are intentionally conservative — scoring.ts still rewards
 * gloves that fall near the center of the range rather than at the edges.
 */

import type {
  SportType,
  PositionType,
  ExperienceLevel,
  SizeRecommendation,
} from "./types";

type AgeGroup = "youth" | "teen" | "adult";

interface SizeLookupInput {
  sport: SportType;
  ageGroup: AgeGroup;
  primaryPosition: PositionType;
  experienceLevel?: ExperienceLevel;
  fastpitchFitImportant?: boolean;
  wantsVersatility?: boolean;
}

/**
 * Base table: sizes in inches per sport × position × age group.
 * Values are the "sweet spot" range before modifiers.
 */
const SIZE_TABLE: Record<
  SportType,
  Record<PositionType, Record<AgeGroup, [number, number]>>
> = {
  baseball: {
    infield: {
      youth: [10.5, 11.25],
      teen: [11.25, 11.5],
      adult: [11.25, 11.75],
    },
    outfield: {
      youth: [11.5, 12.0],
      teen: [12.0, 12.5],
      adult: [12.25, 12.75],
    },
    pitcher: {
      youth: [11.0, 11.5],
      teen: [11.5, 12.0],
      adult: [11.5, 12.25],
    },
    catcher: {
      youth: [31.5, 32.5], // circumference, in inches
      teen: [32.0, 33.0],
      adult: [32.5, 34.0],
    },
    first_base: {
      youth: [11.5, 12.0],
      teen: [12.0, 12.5],
      adult: [12.5, 13.0],
    },
    utility: {
      youth: [11.25, 11.75],
      teen: [11.5, 12.25],
      adult: [11.75, 12.5],
    },
  },
  fastpitch: {
    infield: {
      youth: [11.0, 11.5],
      teen: [11.5, 12.0],
      adult: [11.75, 12.25],
    },
    outfield: {
      youth: [11.75, 12.25],
      teen: [12.25, 12.75],
      adult: [12.5, 13.0],
    },
    pitcher: {
      youth: [11.5, 12.0],
      teen: [12.0, 12.5],
      adult: [12.0, 12.5],
    },
    catcher: {
      youth: [32.0, 33.0],
      teen: [32.5, 33.5],
      adult: [33.0, 34.5],
    },
    first_base: {
      youth: [12.0, 12.5],
      teen: [12.5, 13.0],
      adult: [12.75, 13.25],
    },
    utility: {
      youth: [11.5, 12.0],
      teen: [12.0, 12.5],
      adult: [12.25, 12.75],
    },
  },
  slowpitch: {
    infield: {
      youth: [11.5, 12.0],
      teen: [12.0, 12.5],
      adult: [12.5, 13.0],
    },
    outfield: {
      youth: [12.0, 12.5],
      teen: [12.5, 13.0],
      adult: [13.0, 14.0],
    },
    pitcher: {
      youth: [11.75, 12.25],
      teen: [12.25, 12.75],
      adult: [12.5, 13.0],
    },
    catcher: {
      youth: [32.0, 33.0],
      teen: [33.0, 34.0],
      adult: [33.5, 34.5],
    },
    first_base: {
      youth: [12.5, 13.0],
      teen: [13.0, 13.5],
      adult: [13.0, 13.5],
    },
    utility: {
      youth: [12.0, 12.5],
      teen: [12.5, 13.0],
      adult: [12.75, 13.5],
    },
  },
};

/** Nudge utility that keeps ranges on clean quarter-inch steps. */
function nudge(range: [number, number], delta: number): [number, number] {
  return [
    Math.round((range[0] + delta) * 4) / 4,
    Math.round((range[1] + delta) * 4) / 4,
  ];
}

/**
 * Primary API — returns a SizeRecommendation for display on the results page.
 */
export function recommendSize(input: SizeLookupInput): SizeRecommendation {
  const {
    sport,
    ageGroup,
    primaryPosition,
    experienceLevel,
    fastpitchFitImportant,
    wantsVersatility,
  } = input;

  let [min, max] = SIZE_TABLE[sport][primaryPosition][ageGroup];
  const reasons: string[] = [];

  // Fastpitch players who flagged fit-importance skew slightly smaller
  // to prioritize a closer hand opening.
  if (sport === "fastpitch" && fastpitchFitImportant) {
    [min, max] = nudge([min, max], -0.25);
    reasons.push("tightened a quarter inch for fastpitch-specific fit");
  }

  // Slowpitch utility players and anyone asking for versatility
  // get a little extra pocket space.
  if (wantsVersatility && primaryPosition !== "catcher") {
    [min, max] = nudge([min, max], +0.25);
    reasons.push("added a quarter inch for cross-position versatility");
  }

  // Beginners benefit from the lower half of the range (lighter, easier close).
  if (experienceLevel === "beginner" && primaryPosition !== "catcher") {
    max = Math.max(min, max - 0.25);
    reasons.push("trimmed top of range for easier beginner control");
  }

  const unitLabel = primaryPosition === "catcher" ? "in (circ.)" : "in";
  const label = `${min}${unitLabel === "in" ? '"' : ""} – ${max}${unitLabel === "in" ? '"' : ""}`;

  const posLabel = primaryPosition.replace("_", " ");
  const reason = reasons.length
    ? `Typical ${sport} ${posLabel} range for ${ageGroup} players, ${reasons.join(" and ")}.`
    : `Typical ${sport} ${posLabel} range for ${ageGroup} players.`;

  return {
    min,
    max,
    label: primaryPosition === "catcher" ? `${min}" – ${max}" circumference` : label,
    reason,
  };
}

/**
 * Lightweight helper used by scoring.ts — returns just the numeric range.
 * Keeps the scoring pipeline independent of display formatting.
 */
export function sizeRange(input: SizeLookupInput): [number, number] {
  const rec = recommendSize(input);
  return [rec.min, rec.max];
}
