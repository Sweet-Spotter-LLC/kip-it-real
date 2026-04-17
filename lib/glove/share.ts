/**
 * Kip It Real — share-text formatting helpers.
 *
 * Small, pure functions that turn a results payload into plain-text and
 * mailto-friendly strings. Centralised here so the results page, a future
 * "share to socials" button, and any server-side email sender all use the
 * same wording.
 */

import type { GloveMatchResult, UserProfile } from "./types";
import { POSITION_LABELS, SPORT_LABELS } from "./constants";

export interface ShareInput {
  results: GloveMatchResult[];
  profile: UserProfile;
  /** Origin (e.g. https://kip-it-real.vercel.app) for absolute glove URLs. */
  origin?: string;
}

const BRAND_LINE = "— via Kip It Real · Powered by Sweet Spotter";

/** Build an absolute URL for a glove detail page when an origin is known. */
function gloveUrl(origin: string | undefined, id: string): string {
  const path = `/glove/${id}`;
  if (!origin) return path;
  return `${origin.replace(/\/+$/, "")}${path}`;
}

/** Short one-line summary of the player profile — used as intro. */
function profileIntro(profile: UserProfile): string {
  const sport = SPORT_LABELS[profile.sport];
  const pos = POSITION_LABELS[profile.primaryPosition];
  const hand = profile.throwHand === "RHT" ? "right-handed" : "left-handed";
  return `Profile: ${sport} · ${pos} · ${hand} · budget $${profile.budgetMin}–$${profile.budgetMax}`;
}

/**
 * Plain-text clipboard-friendly summary of the top matches.
 *
 * Shape:
 *   Kip It Real — your top 3 glove matches
 *
 *   Profile: Baseball · Infield · right-handed · budget $0–$300
 *
 *   1. Rawlings Heart of the Hide 11.5" — 92 match
 *      $249 · Rawlings
 *      Why: Built for infield — tagged for your exact spot. Size 11.5" lands…
 *      https://kip-it-real.vercel.app/glove/rawlings-hoh-11-5
 *
 *   (…next match…)
 *
 *   — via Kip It Real · Powered by Sweet Spotter
 */
export function formatResultsAsText({
  results,
  profile,
  origin,
}: ShareInput): string {
  if (results.length === 0) {
    return [
      "Kip It Real — your glove matches",
      "",
      profileIntro(profile),
      "",
      "No matches fit your criteria yet. Retake the quiz to widen your search.",
      "",
      BRAND_LINE,
    ].join("\n");
  }

  const header = `Kip It Real — your top ${results.length} glove ${
    results.length === 1 ? "match" : "matches"
  }`;

  const lines: string[] = [header, "", profileIntro(profile), ""];

  results.forEach((match, i) => {
    const { glove, score, reasons } = match;
    const topReason = reasons[0] ?? "Selected by the Kip It Real scoring engine.";
    lines.push(`${i + 1}. ${glove.name} — ${score} match`);
    lines.push(`   $${glove.price} · ${glove.brand}`);
    lines.push(`   Why: ${topReason}`);
    lines.push(`   ${gloveUrl(origin, glove.id)}`);
    lines.push("");
  });

  lines.push(BRAND_LINE);
  return lines.join("\n");
}

/**
 * Build a mailto: URL with prefilled subject and body.
 * Falls back to a safe empty body if `results` is empty.
 */
export function buildMailtoUrl(input: ShareInput, to = ""): string {
  const subject = "Your Kip It Real glove matches";
  const body = formatResultsAsText(input);
  const params = new URLSearchParams({ subject, body });
  // URLSearchParams encodes spaces as "+"; mail clients prefer %20.
  const query = params.toString().replace(/\+/g, "%20");
  return `mailto:${to}?${query}`;
}
