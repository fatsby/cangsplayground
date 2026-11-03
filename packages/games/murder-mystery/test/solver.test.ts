import { describe, expect, it } from "vitest";
import { evalExpr, type World } from "../src/model.js";
import { availableActions, candidateAnswers, enumerateWorlds, proofSets } from "../src/solver.js";
import {
  DOMAINS,
  PUBLIC_RULE,
  all,
  any,
  cloneLogic,
  fact,
  is,
  makeLogicFixture,
  not,
  withUnverifiedAccusation,
} from "./fixtures.js";

const world: World = {
  id: "w",
  answer: { suspectId: "s3", weaponId: "w2", roomId: "r4" },
  facts: { f1: true, f2: false },
};

describe("evalExpr", () => {
  it("reads facts and answer fields", () => {
    expect(evalExpr(fact("f1"), world)).toBe(true);
    expect(evalExpr(fact("f2"), world)).toBe(false);
    expect(evalExpr(fact("missing"), world)).toBe(false);
    expect(evalExpr(is("weaponId", "w2"), world)).toBe(true);
    expect(evalExpr(is("weaponId", "w1"), world)).toBe(false);
  });

  it("combines with not/all/any and treats empty all as true, empty any as false", () => {
    expect(evalExpr(not(fact("f2")), world)).toBe(true);
    expect(evalExpr(all(fact("f1"), is("roomId", "r4")), world)).toBe(true);
    expect(evalExpr(all(fact("f1"), fact("f2")), world)).toBe(false);
    expect(evalExpr(any(fact("f2"), is("roomId", "r4")), world)).toBe(true);
    expect(evalExpr(all(), world)).toBe(true);
    expect(evalExpr(any(), world)).toBe(false);
  });
});

describe("enumerateWorlds", () => {
  it("enumerates the full 4x3x4 answer domain times every fact assignment, then filters", () => {
    const worlds = enumerateWorlds(DOMAINS, PUBLIC_RULE);
    // 4*3*4*2^2 = 192 raw; f1 && room r3 removed: 4*3*1*2 = 24
    expect(worlds).toHaveLength(168);
    expect(worlds.every((w) => evalExpr(PUBLIC_RULE, w))).toBe(true);
    expect(new Set(worlds.map((w) => w.id)).size).toBe(worlds.length);
    const answers = new Set(
      worlds.map((w) => `${w.answer.suspectId}|${w.answer.weaponId}|${w.answer.roomId}`),
    );
    expect(answers.size).toBe(48);
  });

  it("is deterministic and keeps ids stable regardless of the constraint", () => {
    const a = enumerateWorlds(DOMAINS, PUBLIC_RULE);
    const b = enumerateWorlds(DOMAINS, PUBLIC_RULE);
    expect(b).toEqual(a);
    const unfiltered = enumerateWorlds(DOMAINS, all());
    const byId = new Map(unfiltered.map((w) => [w.id, w]));
    for (const w of a) expect(byId.get(w.id)).toEqual(w);
  });
});

describe("candidateAnswers", () => {
  it("leaves several suspects open at the start and one answer after any four actions", () => {
    const c = makeLogicFixture();
    const start = candidateAnswers(c, c.initialCardIds);
    expect(start.length).toBeGreaterThan(1);
    expect(new Set(start.map((x) => x.suspectId)).size).toBeGreaterThan(1);
    const end = candidateAnswers(c, [...c.initialCardIds, "cs1", "cw1", "cr2"]);
    expect(end).toEqual([{ suspectId: "s3", weaponId: "w2", roomId: "r4" }]);
  });

  it("ignores unverified statements entirely", () => {
    const c = makeLogicFixture();
    const u = withUnverifiedAccusation(c);
    expect(candidateAnswers(u, [...c.initialCardIds, "unverified"])).toEqual(
      candidateAnswers(c, c.initialCardIds),
    );
  });

  it("applies public rules to what verified findings imply", () => {
    const c = makeLogicFixture();
    // i3 leaves r3/r4; "door locked" (cr2) removes r3 only through the public rule.
    const rooms = new Set(candidateAnswers(c, ["i3", "cr2"]).map((a) => a.roomId));
    expect(rooms).toEqual(new Set(["r4"]));
  });

  it("rejects an unknown card id", () => {
    const c = makeLogicFixture();
    expect(() => candidateAnswers(c, ["nope"])).toThrow(/unknown card/);
  });
});

describe("availableActions", () => {
  it("offers every action without prerequisites and honours prerequisites and reuse", () => {
    const c = makeLogicFixture();
    expect(availableActions(c, [], c.initialCardIds).map((a) => a.id)).toEqual([
      "a1",
      "a2",
      "a3",
      "a4",
      "a5",
    ]);
    // the challenge needs the unverified card i4
    expect(availableActions(c, [], ["i1"]).map((a) => a.id)).not.toContain("a5");
    expect(availableActions(c, ["a1"], c.initialCardIds).map((a) => a.id)).not.toContain("a1");
    const gated = cloneLogic(c);
    gated.actions[3]!.requiredActionIds = ["a1"];
    expect(availableActions(gated, [], c.initialCardIds).map((a) => a.id)).not.toContain("a4");
    expect(availableActions(gated, ["a1"], c.initialCardIds).map((a) => a.id)).toContain("a4");
  });
});

describe("proofSets", () => {
  const known = ["i1", "i2", "i3", "i4", "cs1", "cs2", "cw1", "cr1", "cr2"];

  it("finds one- and two-card sets that fix the true field", () => {
    const c = makeLogicFixture();
    expect(proofSets(c, known, "suspectId")).toEqual([
      ["cs1", "i1"],
      ["cs2", "i1"],
    ]);
    expect(proofSets(c, known, "weaponId")).toEqual([["cw1", "i2"]]);
    expect(proofSets(c, known, "roomId")).toEqual([
      ["cr1", "i3"],
      ["cr2", "i3"],
    ]);
  });

  it("returns nothing while the evidence is still ambiguous", () => {
    const c = makeLogicFixture();
    expect(proofSets(c, c.initialCardIds, "suspectId")).toEqual([]);
  });

  it("admits a testimony card only when verified cards in the set entail every claim", () => {
    const c = cloneLogic(makeLogicFixture());
    c.cards.push(
      {
        id: "big",
        sourceKind: "verified",
        claims: [is("weaponId", "w2")],
        constraint: all(is("weaponId", "w2")),
        sourceId: "x",
      },
      {
        id: "tw",
        sourceKind: "testimony",
        claims: [is("weaponId", "w2")],
        constraint: null,
        sourceId: "y",
      },
      {
        id: "tbad",
        sourceKind: "testimony",
        claims: [is("weaponId", "w1")],
        constraint: null,
        sourceId: "z",
      },
    );
    const sets = proofSets(c, ["big", "tw", "tbad"], "weaponId");
    expect(sets).toContainEqual(["big"]);
    expect(sets).toContainEqual(["big", "tw"]);
    expect(sets).not.toContainEqual(["big", "tbad"]);
    expect(sets.some((s) => s.length === 1 && s[0] === "tw")).toBe(false);
  });
});
