import { describe, it, expect } from "vitest";
import { hardFilter, softFilter, filterCatalog } from "@/lib/glove/filters";
import {
  ADULT_INFIELD_BASEBALL_PROFILE,
  FASTPITCH_PROFILE,
  CATCHER_PROFILE,
  BASEBALL_INFIELD_GLOVE,
  BASEBALL_OUTFIELD_GLOVE,
  FASTPITCH_GLOVE,
  CATCHER_MITT,
  DISCONTINUED_GLOVE,
  LHT_ONLY_GLOVE,
  BUDGET_GLOVE,
  SAMPLE_CATALOG,
} from "../fixtures";

// ─── hardFilter ─────────────────────────────────────────────────────────────

describe("hardFilter", () => {
  it("passes a glove that matches all criteria", () => {
    const result = hardFilter(ADULT_INFIELD_BASEBALL_PROFILE, BASEBALL_INFIELD_GLOVE);
    expect(result.passed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("rejects a glove with the wrong sport", () => {
    const result = hardFilter(ADULT_INFIELD_BASEBALL_PROFILE, FASTPITCH_GLOVE);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("wrong_sport");
  });

  it("rejects a fielding glove for a catcher position", () => {
    const result = hardFilter(CATCHER_PROFILE, BASEBALL_INFIELD_GLOVE);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("mitt_required_not_fielding");
  });

  it("rejects a catcher's mitt for a fielding position", () => {
    const result = hardFilter(ADULT_INFIELD_BASEBALL_PROFILE, CATCHER_MITT);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("fielding_required_not_mitt");
  });

  it("rejects a glove that doesn't support the player's throw hand", () => {
    const result = hardFilter(ADULT_INFIELD_BASEBALL_PROFILE, LHT_ONLY_GLOVE);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("throw_hand_unavailable");
  });

  it("rejects a discontinued glove", () => {
    const result = hardFilter(ADULT_INFIELD_BASEBALL_PROFILE, DISCONTINUED_GLOVE);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("not_in_production");
  });

  it("passes catcher mitt for catcher position", () => {
    const result = hardFilter(CATCHER_PROFILE, CATCHER_MITT);
    expect(result.passed).toBe(true);
  });

  it("rejects fastpitch glove for baseball profile", () => {
    const result = hardFilter(ADULT_INFIELD_BASEBALL_PROFILE, FASTPITCH_GLOVE);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("wrong_sport");
  });
});

// ─── softFilter ─────────────────────────────────────────────────────────────

describe("softFilter", () => {
  it("returns no flags for a well-matched glove", () => {
    const flags = softFilter(ADULT_INFIELD_BASEBALL_PROFILE, BASEBALL_INFIELD_GLOVE);
    expect(flags.overBudget).toBe(false);
    expect(flags.brandMismatch).toBe(false);
    expect(flags.fastpitchFitMismatch).toBe(false);
  });

  it("flags overBudget when glove exceeds budget ceiling", () => {
    const profile = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMax: 200 };
    const flags = softFilter(profile, BASEBALL_INFIELD_GLOVE); // $299
    expect(flags.overBudget).toBe(true);
  });

  it("does NOT flag overBudget for a glove at or below budget", () => {
    const profile = { ...ADULT_INFIELD_BASEBALL_PROFILE, budgetMax: 300 };
    const flags = softFilter(profile, BASEBALL_INFIELD_GLOVE); // $299
    expect(flags.overBudget).toBe(false);
  });

  it("flags fastpitchFitMismatch when player needs fastpitch fit but glove lacks it", () => {
    const flags = softFilter(FASTPITCH_PROFILE, {
      ...BASEBALL_INFIELD_GLOVE,
      sport: "fastpitch",
      fastpitchFit: false,
    });
    expect(flags.fastpitchFitMismatch).toBe(true);
  });

  it("does not flag fastpitchFitMismatch when fastpitchFitImportant is false", () => {
    const profile = { ...FASTPITCH_PROFILE, fastpitchFitImportant: false };
    const flags = softFilter(profile, {
      ...BASEBALL_INFIELD_GLOVE,
      sport: "fastpitch",
      fastpitchFit: false,
    });
    expect(flags.fastpitchFitMismatch).toBe(false);
  });

  it("flags youthMismatch for youth player on non-youth-friendly glove", () => {
    const youthProfile = {
      ...ADULT_INFIELD_BASEBALL_PROFILE,
      ageGroup: "youth" as const,
    };
    const flags = softFilter(youthProfile, BASEBALL_INFIELD_GLOVE); // youthFriendly: false
    expect(flags.youthMismatch).toBe(true);
  });

  it("does not flag youthMismatch for adult player", () => {
    const flags = softFilter(ADULT_INFIELD_BASEBALL_PROFILE, BASEBALL_INFIELD_GLOVE);
    expect(flags.youthMismatch).toBe(false);
  });

  it("does not flag youthMismatch for youth player on youth-friendly glove", () => {
    const youthProfile = {
      ...ADULT_INFIELD_BASEBALL_PROFILE,
      ageGroup: "youth" as const,
    };
    const flags = softFilter(youthProfile, BUDGET_GLOVE); // youthFriendly: true
    expect(flags.youthMismatch).toBe(false);
  });
});

// ─── filterCatalog ───────────────────────────────────────────────────────────

describe("filterCatalog", () => {
  it("returns only eligible gloves for baseball infield profile", () => {
    const { eligible, rejected } = filterCatalog(
      ADULT_INFIELD_BASEBALL_PROFILE,
      SAMPLE_CATALOG,
    );
    // All eligible gloves must be baseball fielding type
    for (const g of eligible) {
      expect(g.sport).toBe("baseball");
      expect(g.gloveType).toBe("fielding");
    }
    // Rejected should include wrong sport, wrong type, discontinued, wrong hand
    const rejectedIds = rejected.map((r) => r.glove.id);
    expect(rejectedIds).toContain("test-fastpitch-infield");
    expect(rejectedIds).toContain("test-slowpitch-utility");
    expect(rejectedIds).toContain("test-catcher-mitt");
    expect(rejectedIds).toContain("test-discontinued");
    expect(rejectedIds).toContain("test-lht-only");
  });

  it("returns zero eligible gloves for a sport with no matching records", () => {
    const isolatedCatalog = [FASTPITCH_GLOVE, CATCHER_MITT, DISCONTINUED_GLOVE];
    const { eligible } = filterCatalog(
      ADULT_INFIELD_BASEBALL_PROFILE,
      isolatedCatalog,
    );
    expect(eligible).toHaveLength(0);
  });

  it("passes catcher mitt for catcher profile", () => {
    const { eligible } = filterCatalog(CATCHER_PROFILE, SAMPLE_CATALOG);
    const ids = eligible.map((g) => g.id);
    expect(ids).toContain("test-catcher-mitt");
  });
});
