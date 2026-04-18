/**
 * Kip It Real — qualitative descriptor mappings.
 *
 * The scoring engine operates on numeric ratings, but the results UI now
 * surfaces human-readable descriptors instead of "3/5" badges. Each helper
 * below takes a raw catalog value and returns the player-facing label.
 *
 * Scales recap (see constants.ts for the authoritative ranges):
 *   - leatherQuality: 1 → 5
 *   - breakInTime:    0 → 5   (treat 0 as "Game Ready" like 1)
 *   - fitProfile:    -2 → +3  (mapped into 5 qualitative buckets)
 *
 * Descriptor tables match the product spec:
 *
 *   Dimension │   1       │  2       │  3         │  4       │  5
 *   ──────────┼───────────┼──────────┼────────────┼──────────┼──────────
 *   Leather   │  Budget   │  Basic   │  Standard  │  Premium │  Elite
 *   Break-In  │ Game Ready│  Minimal │  Standard  │  Stiff   │ Very Stiff
 *   Fit       │  Tight    │  Narrow  │  Standard  │  Open    │  Wide
 */

/** Clamp helper — keeps lookups safe when catalog data drifts out of range. */
function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// ─── Leather ─────────────────────────────────────────────────────────────────

const LEATHER_LABELS = [
  "Budget", // 1
  "Basic", // 2
  "Standard", // 3
  "Premium", // 4
  "Elite", // 5
] as const;

export function leatherLabel(leatherQuality: number): string {
  const idx = clamp(Math.round(leatherQuality), 1, 5) - 1;
  return LEATHER_LABELS[idx];
}

// ─── Break-In ────────────────────────────────────────────────────────────────

const BREAK_IN_LABELS = [
  "Game Ready", // 1 (and 0 — collapsed)
  "Minimal", // 2
  "Standard", // 3
  "Stiff", // 4
  "Very Stiff", // 5
] as const;

export function breakInLabel(breakInTime: number): string {
  // Catalog ranges 0..5; collapse 0 → 1 so the descriptor table (which is
  // defined 1..5 in the spec) still covers the full data range.
  const normalised = breakInTime < 1 ? 1 : breakInTime;
  const idx = clamp(Math.round(normalised), 1, 5) - 1;
  return BREAK_IN_LABELS[idx];
}

// ─── Fit ─────────────────────────────────────────────────────────────────────

const FIT_LABELS = [
  "Tight", // 1 (fitProfile ≈ -2)
  "Narrow", // 2 (fitProfile ≈ -1)
  "Standard", // 3 (fitProfile ≈ 0)
  "Open", // 4 (fitProfile ≈ +1)
  "Wide", // 5 (fitProfile ≈ +2 or above)
] as const;

/**
 * Map a -2..+3 fit profile onto one of five buckets.
 * Boundaries use 0.5 steps so values like +0.4 still land on "Standard".
 */
export function fitLabel(fitProfile: number): string {
  if (fitProfile <= -1.5) return FIT_LABELS[0]; // Tight
  if (fitProfile <= -0.5) return FIT_LABELS[1]; // Narrow
  if (fitProfile <= 0.5) return FIT_LABELS[2]; // Standard
  if (fitProfile <= 1.5) return FIT_LABELS[3]; // Open
  return FIT_LABELS[4]; // Wide
}

/**
 * Convenience bundle for rendering a glove's three qualitative dimensions
 * in one call — used by result cards and detail views.
 */
export interface GloveQualitative {
  leather: string;
  breakIn: string;
  fit: string;
}

export function qualitativeFor(input: {
  leatherQuality: number;
  breakInTime: number;
  fitProfile: number;
}): GloveQualitative {
  return {
    leather: leatherLabel(input.leatherQuality),
    breakIn: breakInLabel(input.breakInTime),
    fit: fitLabel(input.fitProfile),
  };
}
