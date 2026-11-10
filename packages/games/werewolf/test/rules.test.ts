import { describe, expect, it } from "vitest";
import { createRng } from "@cangsplayground/core";
import {
  checkWinner,
  dealRoles,
  pickWolfTarget,
  resolveDayVote,
  resolveNight,
  roleCounts,
  validateRoles,
  voteThreshold,
} from "../src/rules.js";
import type { Role } from "../src/types.js";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const tally = (roles: Record<string, Role>) => {
  const out: Record<Role, number> = { werewolf: 0, villager: 0, seer: 0, guard: 0 };
  for (const r of Object.values(roles)) out[r]++;
  return out;
};

describe("roleCounts", () => {
  it("5 players -> 1 werewolf, 1 seer, 1 guard, 2 villagers", () => {
    expect(roleCounts(5)).toEqual({ werewolf: 1, seer: 1, guard: 1, villager: 2 });
  });
  it.each([
    [6, 2],
    [8, 2],
    [10, 3],
  ])("%i players -> %i werewolves", (n, wolves) => {
    expect(roleCounts(n).werewolf).toBe(wolves);
  });
  it("counts always sum to the player count", () => {
    for (let n = 5; n <= 40; n++) {
      const c = roleCounts(n);
      expect(c.werewolf + c.villager + c.seer + c.guard).toBe(n);
    }
  });
});

describe("dealRoles", () => {
  it("deals exactly roleCounts(n) of each role", () => {
    const roles = dealRoles(ids(9), createRng(7));
    expect(tally(roles)).toEqual(roleCounts(9));
    expect(Object.keys(roles).sort()).toEqual(ids(9).sort());
  });
  it("is deterministic for the same seed and varies across seeds", () => {
    expect(dealRoles(ids(8), createRng(3))).toEqual(dealRoles(ids(8), createRng(3)));
    const seen = new Set(
      Array.from({ length: 20 }, (_, s) => JSON.stringify(dealRoles(ids(8), createRng(s)))),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("validateRoles", () => {
  const roles = (list: Role[]) => Object.fromEntries(list.map((r, i) => [`p${i}`, r]));
  it("rejects fewer than 5 players", () => {
    expect(validateRoles(roles(["werewolf", "villager", "villager", "seer"]))).toMatch(
      /at least 5/i,
    );
  });
  it("rejects a game with no werewolf", () => {
    expect(validateRoles(roles(["villager", "villager", "villager", "seer", "guard"]))).toMatch(
      /werewolf/i,
    );
  });
  it("rejects werewolves that are not strictly fewer than everyone else", () => {
    const list: Role[] = ["werewolf", "werewolf", "werewolf", "villager", "villager", "villager"];
    expect(validateRoles(roles(list))).toMatch(/fewer/i);
  });
  it("accepts the default deal for 5 players", () => {
    expect(validateRoles(dealRoles(ids(5), createRng(1)))).toBeNull();
  });
});

describe("pickWolfTarget", () => {
  it("returns null when no wolf voted", () => {
    expect(pickWolfTarget({}, createRng(1))).toBeNull();
  });
  it("returns the unanimous target", () => {
    expect(pickWolfTarget({ w1: "a", w2: "a" }, createRng(1))).toBe("a");
  });
  it("breaks a tie at random among the tied players only", () => {
    const tie = new Set<string | null>();
    for (let s = 0; s < 50; s++)
      tie.add(
        pickWolfTarget({ w1: "a", w2: "b", w3: "c", w4: "c", w5: "a", w6: "b" }, createRng(s)),
      );
    expect([...tie].sort()).toEqual(["a", "b", "c"]);
    const narrow = new Set<string | null>();
    for (let s = 0; s < 50; s++)
      narrow.add(pickWolfTarget({ w1: "a", w2: "b", w3: "c", w4: "c", w5: "a" }, createRng(s)));
    expect([...narrow].sort()).toEqual(["a", "c"]);
  });
});

describe("resolveNight", () => {
  it("a guarded target survives", () => expect(resolveNight("a", "a")).toBeNull());
  it("an unguarded target dies", () => expect(resolveNight("a", "b")).toBe("a"));
  it("no target means nobody dies", () => expect(resolveNight(null, "a")).toBeNull());
});

describe("voteThreshold", () => {
  it.each([
    [1, 1],
    [2, 1],
    [4, 2],
    [5, 3],
    [6, 3],
  ])("%i alive needs %i votes", (alive, need) => expect(voteThreshold(alive)).toBe(need));
});

describe("resolveDayVote", () => {
  const alive5 = ["a", "b", "c", "d", "e"];
  it("5 alive, 3 votes on a -> a", () => {
    expect(resolveDayVote({ b: "a", c: "a", d: "a" }, alive5)).toBe("a");
  });
  it("5 alive, 2 votes -> nobody", () => {
    expect(resolveDayVote({ b: "a", c: "a" }, alive5)).toBeNull();
  });
  it("4 alive split 2-2 -> nobody", () => {
    expect(resolveDayVote({ a: "c", b: "c", c: "a", d: "a" }, ["a", "b", "c", "d"])).toBeNull();
  });
  it("2 alive voting for each other -> nobody", () => {
    expect(resolveDayVote({ a: "b", b: "a" }, ["a", "b"])).toBeNull();
  });
  it("ignores votes whose voter or target is not alive", () => {
    expect(resolveDayVote({ x: "a", b: "z", c: "a", d: "a", e: "a" }, alive5)).toBe("a");
    expect(resolveDayVote({ x: "a", b: "z", c: "a", d: "a" }, alive5)).toBeNull();
  });
});

describe("checkWinner", () => {
  const roles: Record<string, Role> = { w: "werewolf", a: "villager", b: "villager", c: "seer" };
  it("village wins when no werewolf is alive", () => {
    expect(checkWinner(roles, ["a", "b", "c"])).toBe("village");
  });
  it("wolves win when werewolves >= everyone else", () => {
    expect(checkWinner(roles, ["w", "a"])).toBe("wolves");
  });
  it("game continues when werewolves are fewer", () => {
    expect(checkWinner(roles, ["w", "a", "b"])).toBeNull();
  });
});
