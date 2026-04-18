/**
 * Kip It Real — share-text formatting helpers.
 *
 * Small, pure functions that turn a results payload into plain-text and
 * mailto-friendly strings. Centralised here so the results page, a future
 * "share to socials" button, and any server-side email sender all use the
 * same wording.
 */

import type { GloveMatchResult, QuizAnswers, UserProfile } from "./types";
import { POSITION_LABELS, SPORT_LABELS } from "./constants";

// ─── Shareable-link encoding ─────────────────────────────────────────────────
//
// A /results link with `?a=<base64>` is enough to reconstruct the exact quiz
// the user took, so we can share recommendations without relying on
// sessionStorage (which is private to the tab that generated it). The encoded
// string is URL-safe base64 of the JSON-stringified QuizAnswers.
//
// We intentionally keep this as a thin wrapper rather than JWT/ksuid/etc.:
//   - The payload is not sensitive — it's just quiz answers.
//   - We want the link to keep working even if the server restarts or the
//     data layer migrates; no DB lookup required.
//   - Length is well under the ~2000-char safe URL budget for all realistic
//     QuizAnswers shapes.
export const SHARE_QUERY_PARAM = "a";

function toUrlSafeBase64(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromUrlSafeBase64(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  return padded + "=".repeat(padLen);
}

/**
 * Encode a QuizAnswers object as a URL-safe base64 string.
 * Works in both Node (Buffer) and the browser (btoa) environments.
 */
export function encodeQuizAnswers(answers: QuizAnswers): string {
  const json = JSON.stringify(answers);
  if (typeof Buffer !== "undefined") {
    return toUrlSafeBase64(Buffer.from(json, "utf8").toString("base64"));
  }
  // Browser path — btoa only accepts latin-1, so round-trip through encodeURIComponent.
  const latin1 = unescape(encodeURIComponent(json));
  return toUrlSafeBase64(btoa(latin1));
}

/**
 * Decode a base64 share-token back into QuizAnswers.
 * Returns null if the token is malformed rather than throwing — callers can
 * fall back to sessionStorage or route the user back to the quiz.
 */
export function decodeQuizAnswers(token: string): QuizAnswers | null {
  if (!token) return null;
  try {
    const b64 = fromUrlSafeBase64(token);
    let json: string;
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(b64, "base64").toString("utf8");
    } else {
      json = decodeURIComponent(escape(atob(b64)));
    }
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as QuizAnswers;
  } catch {
    return null;
  }
}

/** Build a full shareable results URL from quiz answers. */
export function buildShareUrl(origin: string, answers: QuizAnswers): string {
  const token = encodeQuizAnswers(answers);
  const base = origin.replace(/\/+$/, "");
  return `${base}/results?${SHARE_QUERY_PARAM}=${token}`;
}

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
