import {
  all,
  any,
  fact,
  is,
  not,
  type CaseLogic,
  type Expr,
  type Investigation,
  type LogicalCard,
  type WorldDomains,
} from "../src/model.js";
import { enumerateWorlds } from "../src/solver.js";

export { all, any, fact, is, not };

export const DOMAINS: WorldDomains = {
  suspectIds: ["s1", "s2", "s3", "s4"],
  weaponIds: ["w1", "w2", "w3"],
  roomIds: ["r1", "r2", "r3", "r4"],
  factIds: ["f1", "f2"],
};

/** Public rule: when the door was locked (f1) nobody could use room r3. */
export const PUBLIC_RULE: Expr = any(not(fact("f1")), not(is("roomId", "r3")));

/** True answer of the fixture: s3 with w2 in r4, f1 true and f2 false. */
export const TRUTH = { suspectId: "s3", weaponId: "w2", roomId: "r4" } as const;

const verified = (id: string, sourceId: string, ...claims: Expr[]): LogicalCard => ({
  id,
  sourceKind: "verified",
  claims,
  constraint: all(...claims),
  sourceId,
});

const testimony = (id: string, sourceId: string, ...claims: Expr[]): LogicalCard => ({
  id,
  sourceKind: "testimony",
  claims,
  constraint: null,
  sourceId,
});

const action = (
  id: string,
  kind: Investigation["kind"],
  targetId: string,
  resultCardIds: string[],
  requiredCardIds: string[] = [],
): Investigation => ({
  id,
  kind,
  targetId,
  prompt: `prompt-${id}`,
  requiredCardIds,
  requiredActionIds: [],
  resultCardIds,
});

/**
 * A complete, internally consistent case. Each field is narrowed to two options by an initial
 * verified card; a "decider" card that removes the wrong option is yielded by at least two
 * different actions, so every four-action route (five exist) solves the case with a two-card proof.
 */
export function makeLogicFixture(): CaseLogic {
  const worlds = enumerateWorlds(DOMAINS, PUBLIC_RULE);
  const actual = worlds.find(
    (w) =>
      w.answer.suspectId === TRUTH.suspectId &&
      w.answer.weaponId === TRUTH.weaponId &&
      w.answer.roomId === TRUTH.roomId &&
      w.facts.f1 === true &&
      w.facts.f2 === false,
  );
  if (!actual) throw new Error("fixture truth world missing");
  return {
    domains: DOMAINS,
    worlds,
    actualWorldId: actual.id,
    publicConstraint: PUBLIC_RULE,
    initialCardIds: ["i1", "i2", "i3", "i4"],
    cards: [
      verified("i1", "file-1", any(is("suspectId", "s1"), is("suspectId", "s3"))),
      verified("i2", "file-2", any(is("weaponId", "w1"), is("weaponId", "w2"))),
      verified("i3", "file-3", any(is("roomId", "r3"), is("roomId", "r4"))),
      testimony("i4", "npc-a", is("suspectId", "s1")),
      verified("cs1", "item-1", not(is("suspectId", "s1"))),
      verified("cs2", "npc-b", not(is("suspectId", "s1"))),
      verified("cw1", "item-2", not(is("weaponId", "w1"))),
      verified("cw2", "npc-c", not(is("weaponId", "w1"))),
      verified("cr1", "npc-c", not(is("roomId", "r3"))),
      verified("cr2", "item-3", fact("f1")),
      verified("cs3", "npc-a", not(is("suspectId", "s1"))),
    ],
    actions: [
      action("a1", "inspect", "item-1", ["cs1"]),
      action("a2", "alibi", "npc-b", ["cs2", "cw1"]),
      action("a3", "relationship", "npc-c", ["cw2", "cr1"]),
      action("a4", "inspect", "item-3", ["cr2"]),
      action("a5", "challenge", "npc-a", ["cs3"], ["i4"]),
    ],
  };
}

/** Returns a copy of `logic` with an unverified statement that names the true culprit. */
export function withUnverifiedAccusation(logic: CaseLogic): CaseLogic {
  return {
    ...logic,
    cards: [...logic.cards, testimony("unverified", "npc-x", is("suspectId", TRUTH.suspectId))],
  };
}

/** Deep copy for building named mutations without touching the shared fixture. */
export function cloneLogic(logic: CaseLogic): CaseLogic {
  return structuredClone(logic);
}
