import { describe, it, expect } from "vitest";
import { recommendSize, sizeRange, getSizeOptionsRange } from "@/lib/glove/sizing";

describe("recommendSize", () => {
  // ── Baseball ─────────────────────────────────────────────────────────────

  it("returns correct range for baseball adult infield", () => {
    const rec = recommendSize({
      sport: "baseball",
      ageGroup: "adult",
      primaryPosition: "infield",
    });
    expect(rec.min).toBe(11.25);
    expect(rec.max).toBe(11.75);
    expect(rec.label).toContain("11.25");
    expect(rec.label).toContain("11.75");
  });

  it("returns correct range for baseball youth infield", () => {
    const rec = recommendSize({
      sport: "baseball",
      ageGroup: "youth",
      primaryPosition: "infield",
    });
    expect(rec.min).toBe(10.5);
    expect(rec.max).toBe(11.25);
  });

  it("returns correct range for baseball adult outfield", () => {
    const rec = recommendSize({
      sport: "baseball",
      ageGroup: "adult",
      primaryPosition: "outfield",
    });
    expect(rec.min).toBe(12.25);
    expect(rec.max).toBe(12.75);
  });

  it("returns correct range for baseball adult pitcher", () => {
    const rec = recommendSize({
      sport: "baseball",
      ageGroup: "adult",
      primaryPosition: "pitcher",
    });
    expect(rec.min).toBe(11.5);
    expect(rec.max).toBe(12.25);
  });

  it("returns circumference label for catcher", () => {
    const rec = recommendSize({
      sport: "baseball",
      ageGroup: "adult",
      primaryPosition: "catcher",
    });
    expect(rec.label).toContain("circumference");
    expect(rec.min).toBe(32.5);
    expect(rec.max).toBe(34.0);
  });

  // ── Fastpitch ────────────────────────────────────────────────────────────

  it("returns correct range for fastpitch adult infield", () => {
    const rec = recommendSize({
      sport: "fastpitch",
      ageGroup: "adult",
      primaryPosition: "infield",
    });
    expect(rec.min).toBe(11.75);
    expect(rec.max).toBe(12.25);
  });

  it("nudges range down by 0.25 when fastpitchFitImportant is true", () => {
    const base = recommendSize({
      sport: "fastpitch",
      ageGroup: "adult",
      primaryPosition: "infield",
    });
    const fit = recommendSize({
      sport: "fastpitch",
      ageGroup: "adult",
      primaryPosition: "infield",
      fastpitchFitImportant: true,
    });
    expect(fit.min).toBe(base.min - 0.25);
    expect(fit.max).toBe(base.max - 0.25);
    expect(fit.reason).toContain("fastpitch-specific fit");
  });

  // ── Slowpitch ────────────────────────────────────────────────────────────

  it("returns larger ranges for slowpitch outfield", () => {
    const sp = recommendSize({
      sport: "slowpitch",
      ageGroup: "adult",
      primaryPosition: "outfield",
    });
    const bb = recommendSize({
      sport: "baseball",
      ageGroup: "adult",
      primaryPosition: "outfield",
    });
    expect(sp.min).toBeGreaterThan(bb.min);
    expect(sp.max).toBeGreaterThan(bb.max);
  });

  it("nudges range up when wantsVersatility is true", () => {
    const base = recommendSize({
      sport: "slowpitch",
      ageGroup: "adult",
      primaryPosition: "utility",
    });
    const versatile = recommendSize({
      sport: "slowpitch",
      ageGroup: "adult",
      primaryPosition: "utility",
      wantsVersatility: true,
    });
    expect(versatile.min).toBe(base.min + 0.25);
    expect(versatile.max).toBe(base.max + 0.25);
  });

  // ── Experience modifiers ─────────────────────────────────────────────────

  it("trims max for beginner fielding players", () => {
    const inter = recommendSize({
      sport: "baseball",
      ageGroup: "adult",
      primaryPosition: "infield",
      experienceLevel: "intermediate",
    });
    const beginner = recommendSize({
      sport: "baseball",
      ageGroup: "adult",
      primaryPosition: "infield",
      experienceLevel: "beginner",
    });
    expect(beginner.max).toBeLessThanOrEqual(inter.max);
    expect(beginner.min).toBe(inter.min); // min is unchanged
  });

  it("does not trim max for beginner catchers", () => {
    const beginner = recommendSize({
      sport: "baseball",
      ageGroup: "adult",
      primaryPosition: "catcher",
      experienceLevel: "beginner",
    });
    const advanced = recommendSize({
      sport: "baseball",
      ageGroup: "adult",
      primaryPosition: "catcher",
      experienceLevel: "advanced",
    });
    expect(beginner.max).toBe(advanced.max);
  });
});

describe("sizeRange", () => {
  it("returns [min, max] tuple matching recommendSize", () => {
    const input = {
      sport: "baseball" as const,
      ageGroup: "adult" as const,
      primaryPosition: "infield" as const,
    };
    const rec = recommendSize(input);
    const [min, max] = sizeRange(input);
    expect(min).toBe(rec.min);
    expect(max).toBe(rec.max);
  });
});

describe("getSizeOptionsRange", () => {
  it("returns the table range for a single non-catcher position", () => {
    const range = getSizeOptionsRange("baseball", ["infield"], "adult");
    expect(range).not.toBeNull();
    expect(range!.min).toBe(11.25);
    expect(range!.max).toBe(11.75);
  });

  it("unions ranges across two positions (infield + outfield)", () => {
    const range = getSizeOptionsRange("baseball", ["infield", "outfield"], "adult");
    expect(range).not.toBeNull();
    // min from infield (11.25), max from outfield (12.75)
    expect(range!.min).toBe(11.25);
    expect(range!.max).toBe(12.75);
  });

  it("returns null when only catchers are in the positions list", () => {
    const range = getSizeOptionsRange("baseball", ["catcher"], "adult");
    expect(range).toBeNull();
  });

  it("ignores catcher when mixed with fielding positions", () => {
    const mixed = getSizeOptionsRange("baseball", ["catcher", "infield"], "adult");
    const fieldingOnly = getSizeOptionsRange("baseball", ["infield"], "adult");
    expect(mixed).toEqual(fieldingOnly);
  });

  it("respects age group — youth is smaller than adult", () => {
    const youth = getSizeOptionsRange("baseball", ["infield"], "youth");
    const adult = getSizeOptionsRange("baseball", ["infield"], "adult");
    expect(youth!.min).toBeLessThan(adult!.min);
    expect(youth!.max).toBeLessThan(adult!.max);
  });

  it("returns different ranges for different sports", () => {
    const bb = getSizeOptionsRange("baseball", ["outfield"], "adult");
    const sp = getSizeOptionsRange("slowpitch", ["outfield"], "adult");
    // Slowpitch outfield gloves run larger
    expect(sp!.max).toBeGreaterThan(bb!.max);
  });
});
