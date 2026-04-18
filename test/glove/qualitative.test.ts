import { describe, it, expect } from "vitest";
import {
  leatherLabel,
  breakInLabel,
  fitLabel,
  qualitativeFor,
} from "@/lib/glove/qualitative";

describe("leatherLabel", () => {
  it("maps 1..5 to Budget → Elite", () => {
    expect(leatherLabel(1)).toBe("Budget");
    expect(leatherLabel(2)).toBe("Basic");
    expect(leatherLabel(3)).toBe("Standard");
    expect(leatherLabel(4)).toBe("Premium");
    expect(leatherLabel(5)).toBe("Elite");
  });

  it("clamps out-of-range values to the nearest bucket", () => {
    expect(leatherLabel(-2)).toBe("Budget");
    expect(leatherLabel(99)).toBe("Elite");
  });

  it("rounds fractional ratings", () => {
    expect(leatherLabel(3.4)).toBe("Standard");
    expect(leatherLabel(3.6)).toBe("Premium");
  });
});

describe("breakInLabel", () => {
  it("maps 1..5 to Game Ready → Very Stiff", () => {
    expect(breakInLabel(1)).toBe("Game Ready");
    expect(breakInLabel(2)).toBe("Minimal");
    expect(breakInLabel(3)).toBe("Standard");
    expect(breakInLabel(4)).toBe("Stiff");
    expect(breakInLabel(5)).toBe("Very Stiff");
  });

  it("treats 0 as Game Ready (catalog uses 0..5 range)", () => {
    expect(breakInLabel(0)).toBe("Game Ready");
  });

  it("clamps values above 5", () => {
    expect(breakInLabel(10)).toBe("Very Stiff");
  });
});

describe("fitLabel", () => {
  it("maps fitProfile endpoints onto the qualitative scale", () => {
    expect(fitLabel(-2)).toBe("Tight");
    expect(fitLabel(-1)).toBe("Narrow");
    expect(fitLabel(0)).toBe("Standard");
    expect(fitLabel(1)).toBe("Open");
    expect(fitLabel(2)).toBe("Wide");
    expect(fitLabel(3)).toBe("Wide");
  });

  it("handles fractional values at the bucket boundaries", () => {
    expect(fitLabel(-0.4)).toBe("Standard");
    expect(fitLabel(0.4)).toBe("Standard");
    expect(fitLabel(0.6)).toBe("Open");
    expect(fitLabel(-0.6)).toBe("Narrow");
  });
});

describe("qualitativeFor", () => {
  it("returns all three descriptors in one call", () => {
    const result = qualitativeFor({
      leatherQuality: 5,
      breakInTime: 4,
      fitProfile: -1.5,
    });
    expect(result).toEqual({
      leather: "Elite",
      breakIn: "Stiff",
      fit: "Tight",
    });
  });
});
