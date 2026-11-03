import { describe, expect, it } from "vitest";
import type { CaseLogic, Expr, LogicalCard } from "../src/model.js";
import { enumerateWorlds } from "../src/solver.js";
import { validateCase } from "../src/validate.js";
import {
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

/** Rewrites a verified card's claims and keeps its constraint equal to their conjunction. */
function setClaims(target: LogicalCard, ...claims: Expr[]): void {
  target.claims = claims;
  if (target.sourceKind === "verified") target.constraint = all(...claims);
}

const card = (logic: CaseLogic, id: string) => {
  const found = logic.cards.find((c) => c.id === id);
  if (!found) throw new Error(`fixture card ${id} missing`);
  return found;
};
const action = (logic: CaseLogic, id: string) => {
  const found = logic.actions.find((a) => a.id === id);
  if (!found) throw new Error(`fixture action ${id} missing`);
  return found;
};

function issuesOf(logic: CaseLogic): string {
  const report = validateCase(logic);
  expect(report.ok).toBe(false);
  return report.issues.join("\n");
}

describe("validateCase accepts a sound case", () => {
  it("passes the fixture and counts every distinct four-action route", () => {
    const report = validateCase(makeLogicFixture());
    expect(report).toMatchObject({ ok: true, issues: [] });
    expect(report.terminalPaths).toBe(5);
    expect(report.terminalPaths).toBeGreaterThanOrEqual(2);
  });
});

describe("validateCase rejects named mutations", () => {
  it("route-needs-five-actions: the weapon is only decided when both a2 and a3 are taken", () => {
    const c = cloneLogic(makeLogicFixture());
    // a2 keeps only a weak weapon half-clue; a3's weapon clue no longer says anything about weapons
    setClaims(card(c, "cw1"), any(not(is("weaponId", "w1")), is("suspectId", "s1")));
    setClaims(card(c, "cw2"), not(is("suspectId", "s1")));
    expect(issuesOf(c)).toMatch(/ambiguous/);
  });

  it("one-route-has-no-two-card-proof: unique answer but the weapon needs three cards", () => {
    const c = cloneLogic(makeLogicFixture());
    // both weapon clues are only conditional on the suspect: i2 + clue + a suspect decider = 3 cards
    const half = any(not(is("weaponId", "w1")), is("suspectId", "s1"));
    setClaims(card(c, "cw1"), half);
    setClaims(card(c, "cw2"), half);
    expect(issuesOf(c)).toMatch(/no proof for weaponId/);
  });

  it("confirmed-claim-false-in-truth", () => {
    const c = cloneLogic(makeLogicFixture());
    setClaims(card(c, "cr1"), is("roomId", "r1"));
    expect(issuesOf(c)).toMatch(/false in the true world/);
  });

  it("single-card-reveals-entire-answer", () => {
    const c = cloneLogic(makeLogicFixture());
    setClaims(card(c, "cr2"), is("suspectId", "s3"), is("weaponId", "w2"), is("roomId", "r4"));
    expect(issuesOf(c)).toMatch(/single card/);
  });

  it("unused-initial-card: a verified tautology that nothing needs", () => {
    const c = cloneLogic(makeLogicFixture());
    const tautology = any(fact("f1"), not(fact("f1")));
    const i4 = card(c, "i4");
    i4.sourceKind = "verified";
    setClaims(i4, tautology);
    const a5 = action(c, "a5");
    a5.kind = "inspect";
    a5.requiredCardIds = [];
    expect(issuesOf(c)).toMatch(/unused initial card i4/);
  });

  it("alternate-world-removed-from-universe: a hand-picked candidate list is detected", () => {
    const c = cloneLogic(makeLogicFixture());
    const victim = c.worlds.find(
      (w) => w.answer.suspectId === "s1" && w.answer.weaponId === "w1" && w.answer.roomId === "r1",
    );
    c.worlds = c.worlds.filter((w) => w !== victim);
    expect(issuesOf(c)).toMatch(/world universe/);
  });
});

describe("validateCase rejects structural defects", () => {
  it("unknown fact references in claims or the public constraint", () => {
    const claim = cloneLogic(makeLogicFixture());
    setClaims(card(claim, "cr2"), fact("ghost"));
    expect(issuesOf(claim)).toMatch(/unknown fact ghost/);

    const rule = cloneLogic(makeLogicFixture());
    rule.publicConstraint = any(fact("ghost"), fact("f1"));
    expect(issuesOf(rule)).toMatch(/unknown fact ghost/);
  });

  it("an answer id outside the domain", () => {
    const c = cloneLogic(makeLogicFixture());
    setClaims(card(c, "cs1"), not(is("suspectId", "nobody")));
    expect(issuesOf(c)).toMatch(/unknown suspectId nobody/);
  });

  it("an impossible truth: the actual world violates the public rule", () => {
    const c = cloneLogic(makeLogicFixture());
    c.worlds.push({
      id: "impossible",
      answer: { suspectId: "s3", weaponId: "w2", roomId: "r3" },
      facts: { f1: true, f2: false },
    });
    c.actualWorldId = "impossible";
    expect(issuesOf(c)).toMatch(/actual world .* public/);
  });

  it("a missing actual world", () => {
    const c = cloneLogic(makeLogicFixture());
    c.actualWorldId = "nope";
    expect(issuesOf(c)).toMatch(/actual world/);
  });

  it("wrong domain sizes", () => {
    const c = cloneLogic(makeLogicFixture());
    c.domains.weaponIds = ["w1", "w2"];
    expect(issuesOf(c)).toMatch(/3 weapons/);
  });

  it("more than eight independent facts", () => {
    const c = cloneLogic(makeLogicFixture());
    c.domains.factIds = Array.from({ length: 9 }, (_, i) => `f${i + 1}`);
    expect(issuesOf(c)).toMatch(/at most 8 facts/);
  });

  it("invalid initial or result card counts", () => {
    const initial = cloneLogic(makeLogicFixture());
    initial.initialCardIds = ["i1", "i2", "i3"];
    expect(issuesOf(initial)).toMatch(/exactly 4 initial cards/);

    const none = cloneLogic(makeLogicFixture());
    action(none, "a1").resultCardIds = [];
    expect(issuesOf(none)).toMatch(/1-2 result cards/);

    const three = cloneLogic(makeLogicFixture());
    action(three, "a2").resultCardIds = ["cs2", "cw1", "cr1"];
    expect(issuesOf(three)).toMatch(/1-2 result cards/);
  });

  it("a card delivered by two sources or by none", () => {
    const twice = cloneLogic(makeLogicFixture());
    action(twice, "a1").resultCardIds = ["cs1", "cs2"];
    expect(issuesOf(twice)).toMatch(/delivered more than once/);

    const orphan = cloneLogic(makeLogicFixture());
    orphan.cards.push({
      id: "orphan",
      sourceKind: "testimony",
      claims: [is("suspectId", "s2")],
      constraint: null,
      sourceId: "npc",
    });
    expect(issuesOf(orphan)).toMatch(/never delivered/);
  });

  it("a challenge without evidence from the challenged source", () => {
    const noEvidence = cloneLogic(makeLogicFixture());
    action(noEvidence, "a5").requiredCardIds = [];
    expect(issuesOf(noEvidence)).toMatch(/challenge a5/);

    const wrongSource = cloneLogic(makeLogicFixture());
    action(wrongSource, "a5").requiredCardIds = ["i1"];
    expect(issuesOf(wrongSource)).toMatch(/challenge a5/);
  });

  it("a verified card whose constraint is not exactly its claims", () => {
    const c = cloneLogic(makeLogicFixture());
    card(c, "cs1").constraint = all();
    expect(issuesOf(c)).toMatch(/constraint must equal its claims/);
  });

  it("a testimony card that carries a constraint", () => {
    const c = cloneLogic(makeLogicFixture());
    card(c, "i4").constraint = all(is("suspectId", "s1"));
    expect(issuesOf(c)).toMatch(/testimony card i4/);
  });

  it("a case with a single route", () => {
    const c = cloneLogic(makeLogicFixture());
    // keep only four actions, all required: one four-action route
    c.actions = c.actions.filter((a) => a.id !== "a5");
    c.cards = c.cards.filter((x) => x.id !== "cs3");
    expect(issuesOf(c)).toMatch(/fewer than two/);
  });

  it("a dead end before the fourth action", () => {
    const c = cloneLogic(makeLogicFixture());
    action(c, "a1").requiredActionIds = ["a2"];
    action(c, "a2").requiredActionIds = ["a1"];
    action(c, "a3").requiredActionIds = ["a1"];
    action(c, "a4").requiredActionIds = ["a1"];
    action(c, "a5").requiredActionIds = ["a1"];
    expect(issuesOf(c)).toMatch(/dead end/);
  });

  it("an initial state that already pins down the culprit", () => {
    const c = cloneLogic(makeLogicFixture());
    setClaims(card(c, "i1"), is("suspectId", "s3"));
    expect(issuesOf(c)).toMatch(/at least two suspects/);
  });

  it("a field the public rules already decide", () => {
    const c = cloneLogic(makeLogicFixture());
    c.publicConstraint = all(PUBLIC_RULE, is("roomId", "r4"));
    // keep the supplied universe honest so only the public-rule defect is reported
    c.worlds = enumerateWorlds(c.domains, c.publicConstraint);
    c.actualWorldId = c.worlds.find(
      (w) =>
        w.answer.suspectId === "s3" &&
        w.answer.weaponId === "w2" &&
        w.facts.f1 === true &&
        w.facts.f2 === false,
    )!.id;
    expect(issuesOf(c)).toMatch(/public rules already decide roomId/);
  });
});

describe("validateCase leaves unverified accusations inert", () => {
  it("does not let a testimony naming the culprit change terminal uniqueness", () => {
    const u = withUnverifiedAccusation(makeLogicFixture());
    // the orphan card is flagged, but only as a delivery defect, never as inference
    expect(validateCase(u).issues.join("\n")).not.toMatch(/ambiguous|no proof/);
  });
});
