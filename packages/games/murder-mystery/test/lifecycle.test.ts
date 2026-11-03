import { describe, expect, it } from "vitest";
import type { Conclusion, TeamState } from "../src/types.js";
import { proofSets } from "../src/solver.js";
import { allRoutes, cardsAfter, leadOf, start, toInvestigation, type Harness } from "./helpers.js";

const SECOND = 1000;
const team = (h: Harness, groupId = "g1"): TeamState =>
  h.shared.teams.find((t) => t.groupId === groupId)!;
const cardsOf = (t: TeamState, id: string) =>
  Object.entries(t.owners)
    .filter(([, owner]) => owner === id)
    .map(([card]) => card);

/** Moves the class to investigation round `round` without spending any round. */
function toRound(h: Harness, round: number): void {
  toInvestigation(h);
  for (let r = 1; r < round; r++) h.host("mm:next");
}

function toConclusion(h: Harness): string[] {
  const route = allRoutes(h.shared.caseData.logic)[0]!;
  toInvestigation(h);
  for (let round = 1; round <= 4; round++) {
    for (const t of h.shared.teams) {
      h.player(t.leadOrder[round - 1]!, "mm:investigate", { round, actionId: route[round - 1] });
    }
    h.host("mm:next");
  }
  expect(h.shared.phase).toBe("CONCLUSION");
  return route;
}

describe("connection changes", () => {
  it("keeps cards, members and lead order when a player disconnects and reconnects", () => {
    const h = start([4]);
    const before = structuredClone(team(h));
    h.disconnect("g1p2");
    expect(team(h).connected).toEqual(before.members.filter((m) => m !== "g1p2"));
    expect(team(h)).toMatchObject({
      members: before.members,
      owners: before.owners,
      leadOrder: before.leadOrder,
      active: true,
    });
    h.reconnect("g1p2");
    expect(team(h).connected).toEqual(before.members);
  });

  it("returns the same state when nothing about the roster changed", () => {
    const h = start([3]);
    const before = h.shared;
    h.reconnect("g1p1");
    expect(h.shared).toBe(before);
  });
});

describe("a player leaves for good", () => {
  it("gives each of their cards to the remaining member with fewest cards, ties by member order", () => {
    const h = start([4]);
    const t = team(h);
    const leaver = t.members[1]!;
    const cards = cardsOf(t, leaver);
    h.leave(leaver);
    const after = team(h);
    expect(after.members).toEqual(t.members.filter((m) => m !== leaver));
    expect(after.connected).toEqual(after.members);
    // all had one card, so the first remaining member by frozen order receives it
    for (const card of cards) expect(after.owners[card]).toBe(after.members[0]);
    for (const [card, owner] of Object.entries(t.owners)) {
      if (owner !== leaver) expect(after.owners[card]).toBe(owner);
    }
    expect(Object.keys(after.owners).sort()).toEqual(Object.keys(t.owners).sort());
  });

  it("spreads two cards over two remaining members", () => {
    const h = start([3]);
    const t = team(h);
    const holder = t.members.find((m) => cardsOf(t, m).length === 2)!;
    h.leave(holder);
    const after = team(h);
    expect(after.members.map((m) => cardsOf(after, m).length)).toEqual([2, 2]);
  });

  it("replaces a leaving current lead and all future leads, leaving past leads alone", () => {
    const h = start([4]);
    toRound(h, 2);
    const t = team(h);
    const leaver = t.leadOrder[1]!;
    const order = t.members;
    const next = order[(order.indexOf(leaver) + 1) % order.length]!;
    h.leave(leaver);
    const after = team(h);
    expect(after.leadOrder[0]).toBe(t.leadOrder[0]);
    expect(after.leadOrder[1]).toBe(next);
    expect(after.leadOrder.slice(2)).toEqual(t.leadOrder.slice(2));
    expect(leadOf(h)).toBe(next);
  });

  it("skips a disconnected member when choosing the replacement lead", () => {
    const h = start([4]);
    toRound(h, 2);
    const t = team(h);
    const leaver = t.leadOrder[1]!;
    const order = t.members;
    const first = order[(order.indexOf(leaver) + 1) % order.length]!;
    const second = order[(order.indexOf(leaver) + 2) % order.length]!;
    h.disconnect(first);
    h.leave(leaver);
    expect(leadOf(h)).toBe(second);
  });

  it("lets the replacement lead spend the round and never costs another investigation", () => {
    const h = start([4]);
    toRound(h, 2);
    const route = allRoutes(h.shared.caseData.logic)[0]!;
    const leaver = team(h).leadOrder[1]!;
    h.leave(leaver);
    expect(h.player(leaver, "mm:investigate", { round: 2, actionId: route[0] })).toBe(false);
    expect(h.player(leadOf(h), "mm:investigate", { round: 2, actionId: route[0] })).toBe(true);
    expect(team(h).history).toHaveLength(1);
  });

  it("hands the submitter role to a remaining member during the conclusion", () => {
    const h = start([4]);
    const route = toConclusion(h);
    const leaver = team(h).leadOrder[3]!;
    h.leave(leaver);
    const submitter = team(h).leadOrder[3]!;
    expect(submitter).not.toBe(leaver);
    expect(team(h).members).toContain(submitter);
    const known = cardsAfter(h.shared.caseData.logic, route);
    const { answer } = h.shared.caseData.reveal;
    const conclusion: Conclusion = {
      ...answer,
      evidence: {
        suspectId: proofSets(h.shared.caseData.logic, known, "suspectId")[0]!,
        weaponId: proofSets(h.shared.caseData.logic, known, "weaponId")[0]!,
        roomId: proofSets(h.shared.caseData.logic, known, "roomId")[0]!,
      },
    };
    expect(h.player(leaver, "mm:saveDraft", { draftVersion: 0, conclusion })).toBe(false);
    expect(h.player(submitter, "mm:saveDraft", { draftVersion: 0, conclusion })).toBe(true);
  });

  it("keeps playing with one or two survivors, who hold every card and every lead", () => {
    const h = start([3]);
    toRound(h, 2);
    h.leave("g1p1");
    h.leave("g1p2");
    const after = team(h);
    expect(after.active).toBe(true);
    expect(after.members).toEqual(["g1p3"]);
    expect(new Set(Object.values(after.owners))).toEqual(new Set(["g1p3"]));
    expect(after.leadOrder.slice(1).every((id) => id === "g1p3")).toBe(true);
    const route = allRoutes(h.shared.caseData.logic)[0]!;
    expect(h.player("g1p3", "mm:investigate", { round: 2, actionId: route[0] })).toBe(true);
  });

  it("marks an empty team inactive and keeps any frozen submission", () => {
    const h = start([3, 3]);
    const route = toConclusion(h);
    const submitter = team(h).leadOrder[3]!;
    const known = cardsAfter(h.shared.caseData.logic, route);
    const logic = h.shared.caseData.logic;
    const conclusion: Conclusion = {
      ...h.shared.caseData.reveal.answer,
      evidence: {
        suspectId: proofSets(logic, known, "suspectId")[0]!,
        weaponId: proofSets(logic, known, "weaponId")[0]!,
        roomId: proofSets(logic, known, "roomId")[0]!,
      },
    };
    h.player(submitter, "mm:saveDraft", { draftVersion: 0, conclusion });
    h.player(submitter, "mm:submit", { draftVersion: 1 });
    for (const id of [...team(h).members]) h.leave(id);
    expect(team(h)).toMatchObject({ active: false, members: [], connected: [] });
    expect(team(h).submission).toEqual(conclusion);
    expect(team(h, "g2").active).toBe(true);
    // the class still advances without the empty team
    h.host("mm:next");
    expect(h.shared.phase).toBe("AWAITING_REVEAL");
  });

  it("ignores a player who is on no team", () => {
    const h = start([3]);
    const before = h.shared;
    h.leave("stranger");
    expect(h.shared).toBe(before);
  });
});

describe("host transfer", () => {
  const move = (h: Harness, from: string, to: string, extra: Record<string, unknown> = {}) =>
    h.host("mm:transfer", { groupId: "g1", fromPlayerId: from, toPlayerId: to, ...extra });

  it("moves every card and the current and future leads to a connected teammate", () => {
    const h = start([4, 3]);
    toRound(h, 2);
    const t = team(h);
    const source = t.leadOrder[1]!;
    const target = t.members.find((m) => m !== source && !t.leadOrder.includes(m, 1))!;
    expect(move(h, source, target)).toBe(true);
    const after = team(h);
    expect(cardsOf(after, source)).toEqual([]);
    expect(cardsOf(after, target)).toEqual(
      [...cardsOf(t, target), ...cardsOf(t, source)].sort(
        (a, b) => Object.keys(t.owners).indexOf(a) - Object.keys(t.owners).indexOf(b),
      ),
    );
    expect(after.leadOrder[0]).toBe(t.leadOrder[0]);
    expect(after.leadOrder.slice(1).every((id) => id !== source)).toBe(true);
    expect(leadOf(h)).toBe(target);
    expect(team(h, "g2")).toEqual(h.shared.teams[1]);
  });

  it("persists when the old owner reconnects and lets only the new lead act", () => {
    const h = start([4]);
    toRound(h, 2);
    const source = team(h).leadOrder[1]!;
    const target = team(h).members.find((m) => m !== source && m !== team(h).leadOrder[0])!;
    h.disconnect(source);
    expect(move(h, source, target)).toBe(true);
    h.reconnect(source);
    expect(cardsOf(team(h), source)).toEqual([]);
    const route = allRoutes(h.shared.caseData.logic)[0]!;
    expect(h.player(source, "mm:investigate", { round: 2, actionId: route[0] })).toBe(false);
    expect(h.player(target, "mm:investigate", { round: 2, actionId: route[0] })).toBe(true);
  });

  it("works while paused and in the conclusion", () => {
    const h = start([4]);
    toRound(h, 2);
    h.host("mm:pause");
    const t = team(h);
    expect(move(h, t.members[0]!, t.members[1]!)).toBe(true);
    const c = start([4]);
    toConclusion(c);
    const submitter = team(c).leadOrder[3]!;
    const other = team(c).members.find((m) => m !== submitter)!;
    expect(
      c.host("mm:transfer", { groupId: "g1", fromPlayerId: submitter, toPlayerId: other }),
    ).toBe(true);
    expect(team(c).leadOrder[3]).toBe(other);
  });

  it("rejects bad targets, bad sources, other actors and stale guards without mutating state", () => {
    const h = start([4, 3]);
    toRound(h, 2);
    const t = team(h);
    const [a, b] = t.members;
    const before = h.shared;
    expect(move(h, a!, a!)).toBe(false);
    expect(move(h, a!, "g2p1")).toBe(false);
    expect(move(h, "g2p1", a!)).toBe(false);
    expect(move(h, a!, "ghost")).toBe(false);
    expect(h.host("mm:transfer", { groupId: "g9", fromPlayerId: a, toPlayerId: b })).toBe(false);
    expect(move(h, a!, b!, { phaseVersion: 99 })).toBe(false);
    expect(h.player(a!, "mm:transfer", { groupId: "g1", fromPlayerId: a, toPlayerId: b })).toBe(
      false,
    );
    h.disconnect(b!);
    const disconnected = h.shared;
    expect(move(h, a!, b!)).toBe(false);
    expect(h.shared).toBe(disconnected);
    void before;
    h.tick(SECOND);
  });
});
