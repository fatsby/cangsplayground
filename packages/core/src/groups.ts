import { shuffle, type Rng } from "./rng.js";

/** GRP-01: (a) fixed number of groups, or (b) at most K people per group. */
export type GroupMode = "count" | "maxSize";

/**
 * Balanced group sizes (GRP-04: sizes differ by at most 1).
 * - count:   exactly `value` groups (some may be empty if value > n — validatePlan flags it).
 * - maxSize: ceil(n / value) groups, then balanced (GRP-05: no 1–2 person leftover group).
 * Larger groups come first.
 */
export function planGroupSizes(n: number, mode: GroupMode, value: number): number[] {
  if (!Number.isInteger(n) || n < 0) throw new RangeError("n must be a non-negative integer");
  if (!Number.isInteger(value) || value < 1) throw new RangeError("value must be an integer ≥ 1");
  const k = mode === "count" ? value : Math.max(1, Math.ceil(n / value));
  const base = Math.floor(n / k);
  const extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Shuffles `items` and deals them into balanced groups. */
export function assignGroups<T>(
  items: readonly T[],
  mode: GroupMode,
  value: number,
  rng: Rng,
): T[][] {
  const sizes = planGroupSizes(items.length, mode, value);
  const shuffled = shuffle(items, rng);
  const groups: T[][] = [];
  let at = 0;
  for (const size of sizes) {
    groups.push(shuffled.slice(at, at + size));
    at += size;
  }
  return groups;
}

export interface PlanCheck {
  ok: boolean;
  /** Plain A2-level English, shown on the Host Console. */
  reason?: string;
}

const playerCount = (n: number) => `${n} ${n === 1 ? "player" : "players"}`;

/** GRP-10: at least one group, and every group ≥ the selected game's minimum. */
export function validatePlan(sizes: readonly number[], minPlayersPerGroup = 1): PlanCheck {
  if (sizes.length === 0) return { ok: false, reason: "You need at least 1 group." };
  const smallest = Math.min(...sizes);
  if (smallest < minPlayersPerGroup) {
    return {
      ok: false,
      reason: `Each group needs at least ${playerCount(minPlayersPerGroup)}. Try fewer groups.`,
    };
  }
  return { ok: true };
}

/**
 * GRP-02 preview text:
 *   "24 players → 4 groups × 6"
 *   "25 players, max 6 → 5 groups (5, 5, 5, 5, 5)"
 *   "26 players → 4 groups (7, 7, 6, 6)"
 */
export function describePlan(n: number, mode: GroupMode, value: number): string {
  const sizes = planGroupSizes(n, mode, value);
  const head = mode === "maxSize" ? `${playerCount(n)}, max ${value}` : playerCount(n);
  const groups = `${sizes.length} ${sizes.length === 1 ? "group" : "groups"}`;
  const uniform = sizes.every((s) => s === sizes[0]);
  if (mode === "count" && uniform) return `${head} → ${groups} × ${sizes[0] ?? 0}`;
  return `${head} → ${groups} (${sizes.join(", ")})`;
}
