import { describe, expect, it } from "vitest";
import {
  assignGroups,
  createRng,
  describePlan,
  generateLobbyCode,
  isValidLobbyCode,
  planGroupSizes,
  teamStyle,
  validatePlan,
} from "../src/index.js";

describe("planGroupSizes", () => {
  it("count mode splits evenly", () => {
    expect(planGroupSizes(24, "count", 4)).toEqual([6, 6, 6, 6]);
    expect(planGroupSizes(26, "count", 4)).toEqual([7, 7, 6, 6]);
  });

  it("maxSize mode avoids tiny leftover groups (GRP-05)", () => {
    expect(planGroupSizes(24, "maxSize", 7)).toEqual([6, 6, 6, 6]);
    expect(planGroupSizes(25, "maxSize", 6)).toEqual([5, 5, 5, 5, 5]);
    expect(planGroupSizes(13, "maxSize", 6)).toEqual([5, 4, 4]);
  });

  it("sizes never differ by more than 1 (GRP-04)", () => {
    for (let n = 0; n <= 60; n++) {
      for (let v = 1; v <= 12; v++) {
        for (const mode of ["count", "maxSize"] as const) {
          const sizes = planGroupSizes(n, mode, v);
          expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
          expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
          if (mode === "maxSize") expect(Math.max(...sizes)).toBeLessThanOrEqual(v);
        }
      }
    }
  });
});

describe("assignGroups", () => {
  it("deals every item exactly once, reproducibly per seed", () => {
    const ids = Array.from({ length: 24 }, (_, i) => `p${i}`);
    const a = assignGroups(ids, "count", 4, createRng(42));
    const b = assignGroups(ids, "count", 4, createRng(42));
    expect(a).toEqual(b);
    expect(a.flat().sort()).toEqual(ids.slice().sort());
    expect(a.map((g) => g.length)).toEqual([6, 6, 6, 6]);
  });
});

describe("validatePlan / describePlan", () => {
  it("flags groups below the game minimum (GRP-10)", () => {
    expect(validatePlan([2, 2], 3).ok).toBe(false);
    expect(validatePlan([], 1).ok).toBe(false);
    expect(validatePlan([3, 3], 3).ok).toBe(true);
  });

  it("previews in plain English (GRP-02)", () => {
    expect(describePlan(24, "count", 4)).toBe("24 players → 4 groups × 6");
    expect(describePlan(25, "maxSize", 6)).toBe("25 players, max 6 → 5 groups (5, 5, 5, 5, 5)");
  });

  it("uses the singular for one player", () => {
    expect(describePlan(1, "count", 1)).toBe("1 player → 1 group × 1");
    expect(validatePlan([0], 1).reason).toBe("Each group needs at least 1 player. Try fewer groups.");
  });
});

describe("lobby code & teams", () => {
  it("generates 6-char codes without look-alike characters (LOB-01)", () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      const c = generateLobbyCode(rng);
      expect(isValidLobbyCode(c)).toBe(true);
      expect(c).not.toMatch(/[01OIL]/);
    }
  });

  it("wraps team styles past 8 teams", () => {
    expect(teamStyle(0).name).toBe("Red");
    expect(teamStyle(8)).toMatchObject({ name: "Red 2", outlined: true });
  });
});
