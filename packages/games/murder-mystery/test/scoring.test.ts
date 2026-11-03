import { describe, expect, it } from "vitest";
import { caseTemplates } from "../src/cases/catalogue.js";
import { generateCase } from "../src/generate.js";
import type { CompiledCase } from "../src/model.js";
import { rankTotals, scoreConclusion } from "../src/scoring.js";
import { proofSets } from "../src/solver.js";
import type { Conclusion } from "../src/types.js";
import { allRoutes, cardsAfter } from "./helpers.js";

const cases = (): CompiledCase[] =>
  caseTemplates().map((t) => generateCase(11, { familyId: t.familyId, variantId: t.variantId }));

function best(c: CompiledCase, known: string[]): Conclusion {
  const { answer } = c.reveal;
  return {
    ...answer,
    evidence: {
      suspectId: proofSets(c.logic, known, "suspectId")[0]!,
      weaponId: proofSets(c.logic, known, "weaponId")[0]!,
      roomId: proofSets(c.logic, known, "roomId")[0]!,
    },
  };
}

describe("scoreConclusion", () => {
  it.each(caseTemplates())("gives 10 on every route of $familyId/$variantId", (template) => {
    const c = generateCase(11, { familyId: template.familyId, variantId: template.variantId });
    const routes = allRoutes(c.logic);
    expect(routes.length).toBeGreaterThanOrEqual(2);
    for (const route of routes) {
      const known = cardsAfter(c.logic, route);
      expect(scoreConclusion(c, known, best(c, known))).toEqual({
        suspect: 3,
        weapon: 2,
        room: 2,
        evidence: { suspectId: 1, weaponId: 1, roomId: 1 },
        total: 10,
      });
    }
  });

  it("gives 7 for the right accusation without a valid proof", () => {
    const c = cases()[0]!;
    const known = cardsAfter(c.logic, allRoutes(c.logic)[0]!);
    const empty = { ...best(c, known), evidence: { suspectId: [], weaponId: [], roomId: [] } };
    expect(scoreConclusion(c, known, empty)).toMatchObject({
      total: 7,
      evidence: { suspectId: 0, weaponId: 0, roomId: 0 },
    });
    const wrongCards = {
      ...best(c, known),
      evidence: {
        suspectId: [c.logic.initialCardIds[3]!],
        weaponId: [c.logic.initialCardIds[3]!],
        roomId: [c.logic.initialCardIds[3]!],
      },
    };
    expect(scoreConclusion(c, known, wrongCards).total).toBe(7);
  });

  it("gives 0 for no submission", () => {
    const c = cases()[0]!;
    expect(scoreConclusion(c, c.logic.initialCardIds, null)).toEqual({
      suspect: 0,
      weapon: 0,
      room: 0,
      evidence: { suspectId: 0, weaponId: 0, roomId: 0 },
      total: 0,
    });
  });

  it("gives no evidence point for a field whose answer is wrong, even with a good proof", () => {
    const c = cases()[1]!;
    const known = cardsAfter(c.logic, allRoutes(c.logic)[0]!);
    const wrongSuspect = c.briefing.suspects.find((s) => s.id !== c.reveal.answer.suspectId)!.id;
    const score = scoreConclusion(c, known, { ...best(c, known), suspectId: wrongSuspect });
    // weapon 2 + room 2 + their two evidence points; the culprit and its evidence earn nothing
    expect(score).toMatchObject({
      suspect: 0,
      evidence: { suspectId: 0, weaponId: 1, roomId: 1 },
      total: 6,
    });
  });

  it("gives no evidence point for cards the team has not discovered", () => {
    const c = cases()[2]!;
    const routes = allRoutes(c.logic);
    const known = cardsAfter(c.logic, routes[0]!);
    const proof = best(c, cardsAfter(c.logic, routes[routes.length - 1]!));
    const missing = Object.values(proof.evidence)
      .flat()
      .some((id) => !known.includes(id));
    const score = scoreConclusion(c, known, proof);
    if (missing) expect(score.total).toBeLessThan(10);
    const invented = {
      ...best(c, known),
      evidence: { ...best(c, known).evidence, suspectId: ["zzzzzz"] },
    };
    expect(scoreConclusion(c, known, invented).evidence.suspectId).toBe(0);
  });

  it("accepts a card reused across fields and rejects more than two cards in a slot", () => {
    const c = cases()[0]!;
    const known = cardsAfter(c.logic, allRoutes(c.logic)[0]!);
    const ok = best(c, known);
    const three = { ...ok, evidence: { ...ok.evidence, suspectId: known.slice(0, 3) } };
    expect(scoreConclusion(c, known, three).evidence.suspectId).toBe(0);
    const duplicated = {
      ...ok,
      evidence: {
        ...ok.evidence,
        suspectId: [ok.evidence.suspectId[0]!, ok.evidence.suspectId[0]!],
      },
    };
    expect(scoreConclusion(c, known, duplicated).evidence.suspectId).toBe(0);
  });

  it("scores the same set regardless of the order the cards were chosen", () => {
    const c = cases()[0]!;
    const known = cardsAfter(c.logic, allRoutes(c.logic)[0]!);
    const ok = best(c, known);
    const reversed = {
      ...ok,
      evidence: { ...ok.evidence, suspectId: [...ok.evidence.suspectId].reverse() },
    };
    expect(scoreConclusion(c, known, reversed).total).toBe(10);
  });
});

describe("rankTotals", () => {
  it("ranks descending with shared ranks and skips the places that tied", () => {
    expect(rankTotals([10, 7, 7, 0])).toEqual([1, 2, 2, 4]);
    expect(rankTotals([3, 10, 7])).toEqual([3, 1, 2]);
    expect(rankTotals([5, 5, 5])).toEqual([1, 1, 1]);
    expect(rankTotals([4])).toEqual([1]);
    expect(rankTotals([])).toEqual([]);
  });
});
