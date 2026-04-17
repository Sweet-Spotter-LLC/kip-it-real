import { describe, it, expect } from "vitest";
import { formatResultsAsText, buildMailtoUrl } from "@/lib/glove/share";
import type { GloveMatchResult } from "@/lib/glove/types";
import {
  ADULT_INFIELD_BASEBALL_PROFILE,
  BASEBALL_INFIELD_GLOVE,
  BASEBALL_OUTFIELD_GLOVE,
} from "../fixtures";

function match(
  glove: typeof BASEBALL_INFIELD_GLOVE,
  score: number,
  reason: string,
): GloveMatchResult {
  return {
    glove,
    score,
    reasons: [reason],
    tradeoffs: [],
    avoidIf: [],
    breakdown: [],
  };
}

describe("formatResultsAsText", () => {
  it("renders a header with the match count", () => {
    const text = formatResultsAsText({
      results: [match(BASEBALL_INFIELD_GLOVE, 92, "Infield fit.")],
      profile: ADULT_INFIELD_BASEBALL_PROFILE,
    });
    expect(text).toContain("your top 1 glove match");
  });

  it("numbers matches in order and includes score + price", () => {
    const text = formatResultsAsText({
      results: [
        match(BASEBALL_INFIELD_GLOVE, 92, "Infield fit."),
        match(BASEBALL_OUTFIELD_GLOVE, 80, "Outfield fit."),
      ],
      profile: ADULT_INFIELD_BASEBALL_PROFILE,
    });
    expect(text).toContain("1. Test Rawlings HoH 11.75 — 92 match");
    expect(text).toContain("2. Test Mizuno Outfield 12.75 — 80 match");
    expect(text).toContain(`$${BASEBALL_INFIELD_GLOVE.price}`);
  });

  it("includes the first reason as the 'Why' line", () => {
    const text = formatResultsAsText({
      results: [match(BASEBALL_INFIELD_GLOVE, 90, "Best infield snap.")],
      profile: ADULT_INFIELD_BASEBALL_PROFILE,
    });
    expect(text).toContain("Why: Best infield snap.");
  });

  it("appends the branding line", () => {
    const text = formatResultsAsText({
      results: [match(BASEBALL_INFIELD_GLOVE, 90, "A reason.")],
      profile: ADULT_INFIELD_BASEBALL_PROFILE,
    });
    expect(text.trim().endsWith("— via Kip It Real · Powered by Sweet Spotter")).toBe(
      true,
    );
  });

  it("uses absolute URLs when origin is provided", () => {
    const text = formatResultsAsText({
      results: [match(BASEBALL_INFIELD_GLOVE, 90, "A reason.")],
      profile: ADULT_INFIELD_BASEBALL_PROFILE,
      origin: "https://kip-it-real.vercel.app",
    });
    expect(text).toContain(
      `https://kip-it-real.vercel.app/glove/${BASEBALL_INFIELD_GLOVE.id}`,
    );
  });

  it("handles an empty result list gracefully", () => {
    const text = formatResultsAsText({
      results: [],
      profile: ADULT_INFIELD_BASEBALL_PROFILE,
    });
    expect(text).toContain("No matches fit your criteria");
  });
});

describe("buildMailtoUrl", () => {
  it("produces a mailto link with the expected subject", () => {
    const url = buildMailtoUrl({
      results: [match(BASEBALL_INFIELD_GLOVE, 90, "Reason")],
      profile: ADULT_INFIELD_BASEBALL_PROFILE,
    });
    expect(url.startsWith("mailto:?")).toBe(true);
    expect(decodeURIComponent(url)).toContain("subject=Your Kip It Real glove matches");
  });

  it("embeds the formatted body", () => {
    const url = buildMailtoUrl({
      results: [match(BASEBALL_INFIELD_GLOVE, 90, "Specific reason line")],
      profile: ADULT_INFIELD_BASEBALL_PROFILE,
    });
    expect(decodeURIComponent(url)).toContain("Specific reason line");
  });

  it("supports an explicit recipient", () => {
    const url = buildMailtoUrl(
      {
        results: [match(BASEBALL_INFIELD_GLOVE, 90, "Reason")],
        profile: ADULT_INFIELD_BASEBALL_PROFILE,
      },
      "friend@example.com",
    );
    expect(url.startsWith("mailto:friend@example.com?")).toBe(true);
  });
});
